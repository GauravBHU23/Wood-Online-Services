-- ============================================================================
-- place_order() — atomic order placement, ported from Services/OrderService.cs.
--
-- Runs as one Postgres function (not multiple round-trips from the app) so a crash or
-- connection loss mid-checkout can never half-apply: stock re-check, order + order_items
-- insert, stock decrement and cart clear all happen inside one transaction, or none of them do.
-- ============================================================================

create or replace function public.place_order(
  p_user_id uuid,
  p_cart_key text,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_state text,
  p_shipping_pin_code text,
  p_notes text,
  p_payment_method payment_method
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_sub_total numeric(18,2) := 0;
  v_shipping_charge numeric(18,2) := 0;
  v_free_shipping_above numeric(18,2);
  v_configured_shipping numeric(18,2);
  v_order_number text;
  v_today_prefix text;
  v_today_count int;
  v_candidate text;
  v_line record;
  v_out_of_stock text;
begin
  -- Lock the cart's product rows for the duration of this transaction so a concurrent checkout
  -- (or restock) can't change stock out from under this re-check.
  perform 1
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_key = p_cart_key
  for update of p;

  if not exists (select 1 from public.cart_items where cart_key = p_cart_key) then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  -- Re-check stock at placement time — the cart may have been sitting open for a while.
  for v_line in
    select ci.id as cart_item_id, ci.product_id, ci.quantity, p.name, p.price, p.stock_quantity,
           p.is_available, p.is_custom_order
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_key = p_cart_key
  loop
    if v_line.is_custom_order or not v_line.is_available then
      raise exception '"%" is no longer available. Please remove it from your cart and try again.', v_line.name
        using errcode = 'P0001';
    end if;
    if v_line.quantity > v_line.stock_quantity then
      raise exception '"%" has only % left in stock.', v_line.name, v_line.stock_quantity
        using errcode = 'P0001';
    end if;
    v_sub_total := v_sub_total + (v_line.price * v_line.quantity);
  end loop;

  select shipping_charge, free_shipping_above into v_configured_shipping, v_free_shipping_above
  from public.site_settings where id = 1;

  v_shipping_charge := case
    when v_sub_total <= 0 or v_sub_total >= v_free_shipping_above then 0
    else v_configured_shipping
  end;

  -- Order number: WOS-YYYYMMDD-#### with a walk-forward retry on collision, same as the original.
  v_today_prefix := 'WOS-' || to_char(now() at time zone 'utc', 'YYYYMMDD') || '-';
  select count(*) into v_today_count from public.orders where order_number like v_today_prefix || '%';

  v_candidate := null;
  for i in (v_today_count + 1)..(v_today_count + 1000) loop
    v_candidate := v_today_prefix || lpad(i::text, 4, '0');
    exit when not exists (select 1 from public.orders where order_number = v_candidate);
    v_candidate := null;
  end loop;
  if v_candidate is null then
    v_candidate := v_today_prefix || upper(substr(md5(random()::text), 1, 6));
  end if;

  insert into public.orders (
    order_number, user_id, shipping_name, shipping_phone, shipping_address, shipping_city,
    shipping_state, shipping_pin_code, notes, sub_total, shipping_charge, total_amount,
    payment_method, payment_status, order_status
  ) values (
    v_candidate, p_user_id, p_shipping_name, p_shipping_phone, p_shipping_address, p_shipping_city,
    p_shipping_state, p_shipping_pin_code, nullif(p_notes, ''), v_sub_total, v_shipping_charge,
    v_sub_total + v_shipping_charge, p_payment_method, 'pending', 'pending'
  ) returning * into v_order;

  for v_line in
    select ci.product_id, ci.quantity, p.name, p.price
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_key = p_cart_key
  loop
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order.id, v_line.product_id, v_line.name, v_line.price, v_line.quantity);

    update public.products
    set stock_quantity = greatest(0, stock_quantity - v_line.quantity)
    where id = v_line.product_id;
  end loop;

  delete from public.cart_items where cart_key = p_cart_key;

  return v_order;
end;
$$;

comment on function public.place_order is
  'Atomic checkout: re-checks stock, creates the order + order_items, decrements stock, clears
   the cart. Called via .rpc(''place_order'', {...}) from lib/data/orders.ts with the service
   role client, since it needs to write across tables RLS would otherwise scope per-user.';

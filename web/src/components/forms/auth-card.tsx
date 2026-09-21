import type { ReactNode } from "react";

// Ported from Views/Account/Login.cshtml / Register.cshtml's .panel wrapper.
export function AuthCard({
  title,
  children,
  colClass = "col-md-6 col-lg-5",
}: {
  title: string;
  children: ReactNode;
  colClass?: string;
}) {
  return (
    <div className="container py-5">
      <div className="row">
        <div className={`${colClass} mx-auto`}>
          <div className="panel">
            <div className="panel-header text-center">{title}</div>
            <div className="panel-body">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

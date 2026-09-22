import type { Metadata } from "next";

export const metadata: Metadata = { title: "License" };

// Ported from Controllers/HomeController.cs#License + Views/Home/License.cshtml. The credits
// table is updated to name this stack (Next.js/Supabase) rather than the original's ASP.NET
// Core/Azure SQL — everything else (MIT text, third-party licenses) is unchanged.
export default function LicensePage() {
  const year = new Date().getFullYear();

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">License</h1>
          <p className="text-muted-wood mb-0">Software licensing and attribution</p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="panel mb-4">
              <div className="panel-header">MIT License</div>
              <div className="panel-body">
                <p className="mb-3">
                  <strong>Copyright &copy; {year} Er Gaurav Kumar</strong>
                </p>

                <p>
                  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
                  associated documentation files (the &ldquo;Software&rdquo;), to deal in the Software without
                  restriction, including without limitation the rights to use, copy, modify, merge, publish,
                  distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
                  Software is furnished to do so, subject to the following conditions:
                </p>

                <p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>

                <p className="mb-0" style={{ textTransform: "uppercase", fontSize: ".85rem", color: "var(--ink-soft)" }}>
                  The software is provided &ldquo;as is&rdquo;, without warranty of any kind, express or implied,
                  including but not limited to the warranties of merchantability, fitness for a particular purpose
                  and noninfringement. In no event shall the authors or copyright holders be liable for any claim,
                  damages or other liability, whether in an action of contract, tort or otherwise, arising from, out
                  of or in connection with the software or the use or other dealings in the software.
                </p>
              </div>
            </div>

            <div className="panel mb-4">
              <div className="panel-header">Credits</div>
              <div className="panel-body">
                <table className="table table-sm spec-table mb-0">
                  <tbody>
                    <tr>
                      <th>Designed &amp; Developed by</th>
                      <td>Er Gaurav Kumar</td>
                    </tr>
                    <tr>
                      <th>Framework</th>
                      <td>Next.js (App Router, TypeScript)</td>
                    </tr>
                    <tr>
                      <th>Database &amp; Auth</th>
                      <td>Supabase (Postgres)</td>
                    </tr>
                    <tr>
                      <th>UI Framework</th>
                      <td>Bootstrap 5 (MIT License)</td>
                    </tr>
                    <tr>
                      <th>Payment Gateway</th>
                      <td>Cashfree Payments</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">Third-Party Licenses</div>
              <div className="panel-body">
                <p className="small text-muted-wood mb-3">This application uses the following open source components, each under its own license:</p>
                <ul className="mb-0" style={{ fontSize: ".92rem" }}>
                  <li>
                    <strong>Bootstrap 5</strong> — MIT License
                  </li>
                  <li>
                    <strong>Next.js</strong> — MIT License (Vercel)
                  </li>
                  <li>
                    <strong>React</strong> — MIT License (Meta)
                  </li>
                  <li>
                    <strong>Supabase JS</strong> — MIT License
                  </li>
                  <li>
                    <strong>Zod</strong> — MIT License
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export default function MainLayout() {
  return (
    <div
      className="flex h-dvh w-full overflow-hidden"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <Sidebar />

      <div className="flex min-h-0 w-full flex-1 flex-col md:ml-[72px] md:w-[calc(100%-72px)]">
        <div className="sticky top-0 z-40 flex-shrink-0">
          <Header />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-6 md:pb-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
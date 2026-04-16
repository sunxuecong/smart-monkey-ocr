import { createBrowserRouter, RouterProvider } from "react-router";

const createAppRouter = () =>
  createBrowserRouter([
    {
      path: "/",
      lazy: () => import("@/app/routes/home"),
    },
    {
      path: "/screenshot-overlay",
      lazy: () => import("@/app/routes/screenshot-overlay"),
    },
    {
      path: "*",
      lazy: () => import("@/app/routes/not-found"),
    },
  ]);

export default function AppRouter() {
  return <RouterProvider router={createAppRouter()} />;
}

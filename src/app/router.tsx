import { createBrowserRouter, RouterProvider } from "react-router";

const createAppRouter = () =>
  createBrowserRouter([
    {
      path: "/",
      lazy: () => import("@/app/routes/home"),
    },
    {
      path: "/image-picker",
      lazy: () => import("@/app/routes/image-picker"),
    },
    {
      path: "*",
      lazy: () => import("@/app/routes/not-found"),
    },
  ]);

export default function AppRouter() {
  return <RouterProvider router={createAppRouter()} />;
}

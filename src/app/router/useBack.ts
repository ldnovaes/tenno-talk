import { useContext } from "react";
import { useNavigate } from "react-router";
import { BackContext } from "./navigationHistoryContext";
import { paths } from "./paths";
export function useBack(fallback: string = paths.chats()) {
  const navigate = useNavigate();
  const canGoBack = useContext(BackContext);
  return () => (canGoBack ? navigate(-1) : navigate(fallback, { replace: true }));
}

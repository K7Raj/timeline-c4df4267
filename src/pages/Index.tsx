import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import { getCurrentUser, listUsers } from "@/lib/auth-store";

const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    if (listUsers().length === 0) return; // bootstrap flow handles UI
    const user = getCurrentUser();
    if (user) {
      navigate(user.role === "admin" ? "/admin" : "/home", { replace: true });
    }
  }, [navigate]);
  return <Login />;
};

export default Index;

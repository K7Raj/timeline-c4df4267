import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Home from "./pages/Home.tsx";
import Surprise from "./pages/Surprise.tsx";
import Media from "./pages/Media.tsx";
import Timeline from "./pages/Timeline.tsx";
import Admin from "./pages/Admin.tsx";
import Wish from "./pages/Wish.tsx";
import Stats from "./pages/Stats.tsx";
import Rhythm from "./pages/Rhythm.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/home" element={<Home />} />
          <Route path="/surprise" element={<Surprise />} />
          <Route path="/media" element={<Media />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/wish" element={<Wish />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/rhythm" element={<Rhythm />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

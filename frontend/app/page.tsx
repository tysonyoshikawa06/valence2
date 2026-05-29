"use client";

import { useState, useEffect } from "react";
import Graph, { useGraphActions } from "../components/Graph";
import GoogleSignInButton from "../components/GoogleSignInButton";
import Sidebar from "../components/Sidebar";
import { useAuth } from "./context/AuthContext";

export default function Home() {
  const { user, logout, loading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [filter, setFilter] = useState({ unit1: true, unit2: true });

  const { resetGraph, completeAllNodes } = useGraphActions();

  useEffect(() => {
    window.dispatchEvent(new Event("refreshGraph"));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#edf9fe]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001554]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#edf9fe]">
        <h1 className="text-4xl font-bold mb-8 text-[#001554]">Welcome to Valence</h1>
        <GoogleSignInButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf9fe]">
      {/* Navbar */}
      <nav className="bg-[#001554] fixed top-0 left-0 right-0 z-40 h-16">
        <div className="px-4 h-full flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">AP Chemistry Graph</h1>

          {/* Right: Admin + Profile */}
          <div className="flex items-center gap-1">
            {/* Admin Icon */}
            <div className="relative">
              <button
                onClick={() => { setAdminOpen(!adminOpen); setProfileOpen(false); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Admin"
              >
                <svg className="w-5 h-5 text-[#93a0ba]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {adminOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAdminOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-[#93a0ba]/20 z-50 overflow-hidden">
                    <div className="p-1">
                      <button
                        onClick={() => { completeAllNodes(); setAdminOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#001554] hover:bg-[#edf9fe] rounded-lg transition-colors cursor-pointer"
                      >
                        Complete All Nodes
                      </button>
                      <button
                        onClick={() => { resetGraph(); setAdminOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Reset Graph
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setAdminOpen(false); }}
                className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full ring-2 ring-white/20" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#93a0ba]/20 z-50 overflow-hidden">
                    <div className="p-4 border-b border-[#93a0ba]/10">
                      <div className="flex items-center gap-3">
                        <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#001554] truncate text-sm">{user.name}</p>
                          <p className="text-xs text-[#93a0ba] truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { logout(); setProfileOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar — always visible */}
      <Sidebar filter={filter} setFilter={setFilter} />

      {/* Main content offset for fixed sidebar */}
      <main className="pt-16 pl-64">
        <div className="p-8">
          <Graph filter={filter} />
        </div>
      </main>
    </div>
  );
}

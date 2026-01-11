"use client";

import { useState } from "react";
import Graph, { useGraphActions } from "../components/Graph";
import GoogleSignInButton from "../components/GoogleSignInButton";
import Sidebar from "../components/Sidebar";
import { useAuth } from "./context/AuthContext";

export default function Home() {
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filter, setFilter] = useState({
    unit1: true,
    unit2: true,
  });

  const { resetGraph, completeAllNodes } = useGraphActions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <h1 className="text-4xl font-bold mb-8">Welcome to Valence v2</h1>
        <GoogleSignInButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Hamburger + Title + Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold">AP Chemistry Graph</h1>

            {/* Action Buttons - Desktop */}
            <div className="hidden sm:flex items-center gap-2 ml-4">
              <button
                onClick={completeAllNodes}
                className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
              >
                Complete All
              </button>
              <button
                onClick={resetGraph}
                className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Right: Profile */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2 transition-colors"
            >
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  {/* User Info */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{user.name}</p>
                        <p className="text-sm text-gray-600 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - Mobile Only */}
                  <div className="p-2 border-b border-gray-200 sm:hidden">
                    <button
                      onClick={() => {
                        completeAllNodes();
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors mb-1"
                    >
                      Complete All Nodes
                    </button>
                    <button
                      onClick={() => {
                        resetGraph();
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Reset Graph
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        filter={filter}
        setFilter={setFilter}
      />

      {/* Main Content */}
      <main className="pt-16 pl-0 transition-all duration-300">
        <div className="p-8">
          <Graph filter={filter} />
        </div>
      </main>

      {/* Overlay when sidebar is open on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

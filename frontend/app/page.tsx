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
      <div className="bg-[#edf9fe]">
        {/* ── Hero (light blue → white) ── */}
        <section className="relative min-h-screen bg-[linear-gradient(to_bottom,#edf9fe_75%,white_100%)] flex flex-col items-center justify-center px-6 pt-24 pb-12 text-center overflow-hidden">
          {/* Decorative background nodes */}
          <div className="absolute inset-0 pointer-events-none select-none">
            <div className="absolute top-16 left-12 w-3 h-3 rounded-full bg-[#001554]/5" />
            <div className="absolute top-24 left-32 w-2 h-2 rounded-full bg-[#001554]/5" />
            <div className="absolute top-12 right-20 w-4 h-4 rounded-full bg-[#001554]/5" />
            <div className="absolute top-36 right-10 w-2 h-2 rounded-full bg-[#001554]/5" />
            <div className="absolute bottom-24 left-16 w-4 h-4 rounded-full bg-[#001554]/5" />
            <div className="absolute bottom-16 left-36 w-2 h-2 rounded-full bg-[#001554]/5" />
            <div className="absolute bottom-32 right-24 w-3 h-3 rounded-full bg-[#001554]/5" />
            <div className="absolute bottom-12 right-12 w-2 h-2 rounded-full bg-[#001554]/5" />
            <svg
              className="absolute inset-0 w-full h-full opacity-[0.06]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line
                x1="12%"
                y1="10%"
                x2="28%"
                y2="18%"
                stroke="#001554"
                strokeWidth="1"
              />
              <line
                x1="28%"
                y1="18%"
                x2="15%"
                y2="28%"
                stroke="#001554"
                strokeWidth="1"
              />
              <line
                x1="72%"
                y1="8%"
                x2="85%"
                y2="20%"
                stroke="#001554"
                strokeWidth="1"
              />
              <line
                x1="85%"
                y1="20%"
                x2="78%"
                y2="32%"
                stroke="#001554"
                strokeWidth="1"
              />
              <line
                x1="10%"
                y1="72%"
                x2="22%"
                y2="82%"
                stroke="#001554"
                strokeWidth="1"
              />
              <line
                x1="78%"
                y1="68%"
                x2="88%"
                y2="78%"
                stroke="#001554"
                strokeWidth="1"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center max-w-lg">
            <img
              src="/valence_circle.png"
              alt="Valence"
              className="h-16 w-16 mb-6 drop-shadow-sm"
            />

            <h1 className="text-5xl font-bold text-[#001554] mb-5 tracking-tight leading-tight">
              Learn chemistry
              <br />
              by staying curious
            </h1>
            <p className="text-[#93a0ba] text-base leading-relaxed mb-8">
              Valence is a knowledge graph for AP Chemistry. Unlock topics by
              asking thoughtful questions to Val, your AI tutor — the more you
              wonder, the further you go.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {[
                {
                  icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
                  label: "13 connected topics",
                },
                {
                  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                  label: "AI tutor on every node",
                },
                {
                  icon: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z",
                  label: "Curiosity-based progression",
                },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-[#001554]/5 border border-[#001554]/10 text-[#001554]/60 text-xs px-3 py-1.5 rounded-full"
                >
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={icon}
                    />
                  </svg>
                  {label}
                </div>
              ))}
            </div>

            <GoogleSignInButton />
            <p className="mt-4 text-xs text-[#93a0ba]">
              Sign in with your school Google account to get started
            </p>
          </div>
        </section>

        <section className="bg-[linear-gradient(to_bottom,white_75%,#edf9fe_100%)] px-6 py-20 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-[#001554] mb-2 text-center">
            How it works
          </h2>
          <p className="text-[#93a0ba] text-sm mb-10 text-center">
            Three steps to mastering AP Chemistry
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            <div className="bg-[#edf9fe] rounded-2xl p-6 text-center">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg
                  className="w-5 h-5 text-[#001554]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-[#001554] mb-2">Explore</h3>
              <p className="text-xs text-[#93a0ba] leading-relaxed">
                Navigate AP Chem topics as a connected knowledge graph
              </p>
            </div>

            <div className="bg-[#edf9fe] rounded-2xl p-6 text-center">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg
                  className="w-5 h-5 text-[#001554]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-[#001554] mb-2">Ask Val</h3>
              <p className="text-xs text-[#93a0ba] leading-relaxed">
                Chat with your AI tutor about any topic on the graph
              </p>
            </div>

            <div className="bg-[#edf9fe] rounded-2xl p-6 text-center">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg
                  className="w-5 h-5 text-[#001554]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-[#001554] mb-2">Unlock</h3>
              <p className="text-xs text-[#93a0ba] leading-relaxed">
                Curious questions unlock neighboring topics on the graph
              </p>
            </div>
          </div>
        </section>

        {/* ── Screenshots (light blue → white) ── */}
        <section className="bg-[linear-gradient(to_bottom,#edf9fe_75%,white_100%)] px-6 py-20 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-[#001554] mb-2 text-center">
            See it in action
          </h2>
          <p className="text-[#93a0ba] text-sm mb-10 text-center">
            Explore topics, chat with Val, and watch the graph grow
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            <div className="flex flex-col gap-3">
              <div className="shadow-md border border-[#93a0ba]/15 aspect-video">
                <img
                  src="/graph_page.png"
                  alt="Knowledge graph view"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-1">
                <p className="text-sm font-medium text-[#001554]">
                  The Knowledge Graph
                </p>
                <p className="text-xs text-[#93a0ba] mt-0.5">
                  Browse all AP Chemistry topics as an interactive graph. Click
                  the connection between two nodes to see how topics are
                  related!
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="shadow-md border border-[#93a0ba]/15 aspect-video">
                <img
                  src="/node_page.png"
                  alt="Node study page"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-1">
                <p className="text-sm font-medium text-[#001554]">
                  Deep-dive into any topic
                </p>
                <p className="text-xs text-[#93a0ba] mt-0.5">
                  Each node has rich content and a live chat with Val. Ask
                  curious questions to earn progress and unlock neighboring
                  nodes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer CTA (white) ── */}
        <section className="bg-white px-6 py-20 flex flex-col items-center text-center">
          <img
            src="/valence_circle.png"
            alt="Valence"
            className="h-10 w-10 mb-4 opacity-80"
          />
          <h2 className="text-2xl font-bold text-[#001554] mb-6">
            Ready to explore?
          </h2>
          <GoogleSignInButton />
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf9fe]">
      {/* Navbar */}
      <nav className="bg-[#001554] fixed top-0 left-0 right-0 z-40 h-16">
        <div className="px-4 h-full flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">
            AP Chemistry Graph
          </h1>

          {/* Right: Admin + Profile */}
          <div className="flex items-center gap-1">
            {/* Admin Icon */}
            <div className="relative">
              <button
                onClick={() => {
                  setAdminOpen(!adminOpen);
                  setProfileOpen(false);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Admin"
              >
                <svg
                  className="w-5 h-5 text-[#93a0ba]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {adminOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAdminOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-[#93a0ba]/20 z-50 overflow-hidden">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          completeAllNodes();
                          setAdminOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#001554] hover:bg-[#edf9fe] rounded-lg transition-colors cursor-pointer"
                      >
                        Complete All Nodes
                      </button>
                      <button
                        onClick={() => {
                          resetGraph();
                          setAdminOpen(false);
                        }}
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
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setAdminOpen(false);
                }}
                className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full ring-2 ring-white/20"
                />
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#93a0ba]/20 z-50 overflow-hidden">
                    <div className="p-4 border-b border-[#93a0ba]/10">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.picture}
                          alt={user.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#001554] truncate text-sm">
                            {user.name}
                          </p>
                          <p className="text-xs text-[#93a0ba] truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
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
      <main className="pt-16 lg:pl-64">
        <div className="p-8">
          <Graph filter={filter} />
        </div>
      </main>
    </div>
  );
}

"use client";

import Graph from "../components/Graph";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "./context/AuthContext";

export default function Home() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      {user ? (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <img
              src={user.picture}
              alt={user.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
          <Graph />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-3xl font-bold mb-8">Welcome to Valence v2</h1>
          <GoogleSignInButton />
        </div>
      )}
    </div>
  );
}

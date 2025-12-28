"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../app/context/AuthContext";

export default function GoogleSignInButton() {
  const { login } = useAuth();

  return (
    <GoogleLogin
      onSuccess={(credentialResponse) => {
        if (credentialResponse.credential) {
          login(credentialResponse.credential);
        }
      }}
      onError={() => {
        console.log("Login Failed");
      }}
      useOneTap
    />
  );
}

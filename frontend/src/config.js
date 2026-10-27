// Base URL of the LensFort backend. Override with REACT_APP_API_URL in
// frontend/.env (see .env.example) when the API runs elsewhere.
export const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

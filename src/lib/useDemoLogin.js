import { useEffect, useState } from "react";
import { api } from "./api";

// Session 43 (v280): demo / bypass buttons follow the SERVER's DEMO_LOGIN switch, not the build.
// v277 tied them to import.meta.env.DEV, so they vanished from every deployed build, test server
// included. The server already refuses dev_bypass tokens unless DEMO_LOGIN=true, so showing the
// buttons only when the server says it is on keeps the public app (DEMO_LOGIN=false) clean.
export default function useDemoLogin() {
  // useState(Boolean(import.meta.env.DEV))
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      Promise.resolve(api.get("auth/demo-enabled", { bypassCache: true }))
        .then((r) => {
          if (alive && r && r.data) {
            setOn(r.data.enabled === true);
          }
        })
        .catch(() => {
          if (alive) setOn(false);
        });
    } catch {
      if (alive) setOn(false);
    }
    return () => { alive = false; };
  }, []);
  return on;
}

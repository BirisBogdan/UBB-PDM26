// NetworkContext.tsx — Online/offline status of the phone

import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

const NetworkContext = createContext<boolean>(true);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
  }, []);

  return <NetworkContext.Provider value={online}>{children}</NetworkContext.Provider>;
}

export function useOnline(): boolean {
  return useContext(NetworkContext);
}

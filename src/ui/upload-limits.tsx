"use client";

import { createContext, useContext } from "react";
import { DEFAULT_FILE_LIMITS, type FileLimits } from "@/domain/upload";

/** B-31: limites das Configurações, lidos uma vez pelo layout e usados por todo campo de envio. */
const UploadLimitsContext = createContext<FileLimits>(DEFAULT_FILE_LIMITS);

export function UploadLimitsProvider({ limits, children }: { limits: FileLimits; children: React.ReactNode }) {
  return <UploadLimitsContext.Provider value={limits}>{children}</UploadLimitsContext.Provider>;
}

export function useUploadLimits(): FileLimits {
  return useContext(UploadLimitsContext);
}

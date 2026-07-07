import { useState, useEffect, useRef, useCallback } from "react";
import { detectAndValidateDocument } from "@/services/fiscal/documentService";
import { TomadorDocumento } from "@/services/fiscal/types";

export function useDocumentDetection(initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TomadorDocumento | null>(null);

  const timeoutRef = useRef<any>(null);

  const runDetection = useCallback(async (docRaw: string) => {
    const clean = docRaw.replace(/\D/g, "");
    if (!clean) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await detectAndValidateDocument(docRaw);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Erro ao consultar o cadastro do tomador.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce de 300ms ao mudar o documento
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      runDetection(value);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, runDetection]);

  const retry = useCallback(() => {
    runDetection(value);
  }, [value, runDetection]);

  return {
    value,
    setValue,
    loading,
    error,
    result,
    retry,
    setResult,
  };
}

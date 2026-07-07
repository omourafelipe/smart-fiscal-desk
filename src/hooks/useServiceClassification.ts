import { useState, useEffect, useRef, useCallback } from "react";
import { classifyService, submitFeedback } from "@/services/fiscal/classificationService";
import { ClassifyServiceResponse, ClassificationFeedback } from "@/services/fiscal/types";

export function useServiceClassification(initialDescription = "") {
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifyServiceResponse | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const timeoutRef = useRef<any>(null);

  const runClassification = useCallback(async (desc: string) => {
    if (!desc.trim()) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await classifyService({ descricao_servico: desc });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao classificar serviço.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce de 500ms ao mudar a descrição
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!description.trim()) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      runClassification(description);
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [description, runClassification]);

  const sendFeedback = useCallback(async (feedback: ClassificationFeedback) => {
    setFeedbackStatus('loading');
    try {
      await submitFeedback(feedback);
      setFeedbackStatus('success');
    } catch (err: any) {
      setFeedbackStatus('error');
    }
  }, []);

  const retry = useCallback(() => {
    runClassification(description);
  }, [description, runClassification]);

  const resetFeedbackStatus = useCallback(() => {
    setFeedbackStatus('idle');
  }, []);

  return {
    description,
    setDescription,
    loading,
    error,
    result,
    feedbackStatus,
    sendFeedback,
    retry,
    setResult,
    resetFeedbackStatus,
  };
}

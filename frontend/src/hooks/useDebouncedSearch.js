import { useState, useEffect, useRef, useCallback } from 'react';

export default function useDebouncedSearch(searchFn, options = {}) {
  const { delay = 300, minChars = 2 } = options;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const clearResults = useCallback(() => {
    setResults([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (query.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const data = await searchFn(query, controller.signal);
        if (!controller.signal.aborted) {
          setResults(data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setLoading(false);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay, minChars, searchFn]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { query, setQuery, results, setResults, loading, clearResults };
}

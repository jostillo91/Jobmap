"use client";

import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { getSearchSuggestions } from "@/lib/api";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "title" | "company";
  onFocus?: () => void;
  onBlur?: () => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      placeholder,
      type = "title",
      onFocus,
      onBlur,
    },
    ref
  ) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Combine refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(inputRef.current);
      } else if (ref) {
        ref.current = inputRef.current;
      }
    }, [ref]);

  // Fetch suggestions when value changes
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const results = await getSearchSuggestions(value, type);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Debounce 300ms

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, type]);

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setShowSuggestions(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
          onFocus?.();
        }}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => {
            setShowSuggestions(false);
            onBlur?.();
          }, 200);
        }}
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? "search-suggestions" : undefined}
        aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          id="search-suggestions"
          ref={suggestionsRef}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              id={`suggestion-${index}`}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelect(suggestion)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100 ${
                index === selectedIndex ? "bg-primary-50 dark:bg-primary-900/20" : ""
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default SearchInput;


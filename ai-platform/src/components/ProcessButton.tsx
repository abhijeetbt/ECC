"use client";

interface ProcessButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}

export default function ProcessButton({
  onClick,
  loading,
  disabled,
}: ProcessButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Generating…" : "Generate tests"}
    </button>
  );
}

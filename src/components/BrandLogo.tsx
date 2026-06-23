import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  textClassName?: string;
};

export default function BrandLogo({
  size = 36,
  className = "",
  textClassName = "text-deliivo-dark",
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="Deliivo"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority
      />
      <span
        className={`font-bold leading-none tracking-tight ${textClassName}`}
        style={{ fontSize: `${Math.round(size * 0.62)}px` }}
      >
        Deliivo
      </span>
    </span>
  );
}

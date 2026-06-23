import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 36, className = "" }: BrandLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Deliivo"
      width={Math.round(size * 2.88)}
      height={size}
      className={className}
      priority
    />
  );
}

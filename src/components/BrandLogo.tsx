import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 36, className = "" }: BrandLogoProps) {
  return (
    <Image
      src="/logo.jpg"
      alt="Deliivo"
      width={Math.round(size * 1.97)}
      height={size}
      className={className}
      priority
    />
  );
}

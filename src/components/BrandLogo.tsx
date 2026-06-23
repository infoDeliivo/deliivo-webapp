import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 36, className = "" }: BrandLogoProps) {
  return (
    <Image
      src="/final-logo.png"
      alt="Deliivo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

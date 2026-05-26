import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}

export default function FeatureCard({ icon: Icon, title, description, href }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white/8 hover:bg-white/12 backdrop-blur-md border border-white/12 hover:border-white/22 rounded-xl p-6 flex flex-col gap-4 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="w-11 h-11 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
        <Icon className="w-5 h-5 text-blue-300" />
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-blue-100/55 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

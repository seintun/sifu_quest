import { auth } from "@/auth";
import { BRAND_EMOJIS, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { DOMAIN_COLORS } from "@/lib/theme";
import { BookOpen, Compass, Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthForm } from "./AuthForm";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-0 sm:p-4 overflow-hidden bg-background">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 hidden sm:block">
        <div
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
          style={{ background: DOMAIN_COLORS.dsa.hex }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
          style={{ background: DOMAIN_COLORS.streak.hex, animationDelay: "2s" }}
        />
        <div
          className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-15"
          style={{ background: DOMAIN_COLORS.plan.hex }}
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[60px]" />
      </div>

      <div className="w-full max-w-[1000px] z-10 grid md:grid-cols-2 gap-6 md:gap-12 items-center px-4 py-4 sm:p-0">
        {/* Left Side - Brand & Value Prop */}
        <div className="space-y-4 md:space-y-8 max-w-sm mx-auto md:max-w-none md:mx-0">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border/50 text-[10px] md:text-xs font-medium text-muted-foreground mb-2 md:mb-6">
              <span className="w-2 h-2 rounded-full bg-streak animate-pulse" />
              {BRAND_EMOJIS.primary} Your path to mastery
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-display font-bold tracking-tight text-foreground">
              {BRAND_NAME}
            </h1>
            <p className="mt-2 md:mt-4 text-sm sm:text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              {BRAND_TAGLINE}. Train with Sifu guidance across DSA, system
              design, and interview execution.
            </p>
          </div>

          <div className="space-y-3 md:space-y-6 pt-2 md:pt-4">
            <Feature
              icon={Compass}
              title={`${BRAND_EMOJIS.fist} Interactive Mastery`}
              description="Learn DSA and System Design with structured roadmaps, corrective feedback, and spaced repetition."
              color={DOMAIN_COLORS.dsa}
            />
            <Feature
              icon={BookOpen}
              title={`${BRAND_EMOJIS.primary} Ask Sifu Coaching`}
              description="Your personal Sifu coach for patterns, mock interviews, and precise corrections."
              color={DOMAIN_COLORS.coach}
            />
            <Feature
              icon={Shield}
              title={`${BRAND_EMOJIS.medal} Private by Design`}
              description="Your data is securely stored in your isolated cloud workspace with strict access controls."
              color={DOMAIN_COLORS.streak}
            />
          </div>
        </div>

        {/* Right Side - Auth Card */}
        <div className="flex flex-col items-center mt-2 md:mt-0">
          <div className="w-full max-w-[400px] rounded-2xl sm:border border-border/50 sm:bg-surface/50 sm:backdrop-blur-xl p-3 sm:p-8 sm:shadow-2xl relative">
            <div className="hidden sm:block absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-foreground/10 to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-4 sm:space-y-6">
              <div className="text-center space-y-1 sm:space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold">
                  Welcome back
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Sign in to continue your journey
                </p>
              </div>

              <AuthForm />

              <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-6 leading-tight">
                By continuing, you trust Sifu Quest with your career progression
                data in your secure, user-scoped cloud workspace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: (typeof DOMAIN_COLORS)[keyof typeof DOMAIN_COLORS];
}) {
  return (
    <div className="flex gap-3 md:gap-4 items-start group">
      <div
        className="shrink-0 p-2 md:p-2.5 rounded-xl border transition-colors duration-300"
        style={{
          backgroundColor: `${color.hex}15`,
          borderColor: `${color.hex}30`,
        }}
      >
        <Icon className="w-4 h-4 md:w-5 md:h-5" style={{ color: color.hex }} />
      </div>
      <div>
        <h3 className="font-medium text-sm md:text-base text-foreground group-hover:text-foreground/90 transition-colors">
          {title}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground leading-snug md:leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

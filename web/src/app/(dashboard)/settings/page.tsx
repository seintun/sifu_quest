"use client";

import { GuestLogoutDialog } from "@/components/auth/GuestLogoutDialog";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  canSaveProviderApiKey,
  shouldShowRemoveApiKey,
} from "@/lib/account-settings-ui";
import { performSignOut } from "@/lib/auth-signout";
import {
  DOJO_TITLE_ROLL_EFFECT_MS,
  generateDojoTitlePhrase,
} from "@/lib/dojo-title";
import { fetcher } from "@/lib/fetcher";
import { startGuestGoogleUpgrade } from "@/lib/guest-upgrade";
import { GuestExpiryBanner } from "@/components/dashboard/GuestExpiryBanner";
import { getOnboardingPrefillName } from "@/lib/onboarding-name";
import { validateFullName } from "@/lib/profile-name";
import { cn } from "@/lib/utils";
import {
  Dice5,
  KeyRound,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";

type AccountStatus = {
  userId: string;
  isGuest: boolean;
  isLinked: boolean;
  displayName: string | null;
  hasProviderKey?: { openrouter: boolean; anthropic: boolean };
  defaultProvider?: "openrouter" | "anthropic";
  defaultModel?: string | null;
  prefillName: string | null;
  avatarUrl: string | null;
};

type UsageTotals = {
  userTurns: number;
  assistantTurns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicrousd: number;
};

type AccountUsage = {
  lifetime: UsageTotals;
  trailing7Days: UsageTotals;
  providerBreakdown: Array<UsageTotals & { provider: string }>;
  modelBreakdown: Array<UsageTotals & { provider: string; model: string }>;
};

type FlashMessage = { text: string; type: "success" | "error" } | null;

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-muted-foreground">Loading settings...</div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-10 w-full bg-muted/40 rounded" />
          <div className="h-9 w-32 bg-muted rounded mt-2" />
        </CardContent>
      </Card>
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-10 w-full bg-muted/40 rounded" />
          <div className="h-9 w-32 bg-muted rounded mt-2" />
        </CardContent>
      </Card>
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-32 bg-muted/40 rounded" />
            <div className="h-32 bg-muted/40 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [apiKeyFieldErrors, setApiKeyFieldErrors] = useState<
    Record<"anthropic" | "openrouter", string>
  >({
    anthropic: "",
    openrouter: "",
  });
  const [fullName, setFullName] = useState("");
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const generateNameResetTimerRef = useRef<number | null>(null);

  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isRemovingKey, setIsRemovingKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [guestLogoutOpen, setGuestLogoutOpen] = useState(false);
  const [googleLogoutOpen, setGoogleLogoutOpen] = useState(false);

  const [message, setMessage] = useState<FlashMessage>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const isDeletePhraseValid = deleteConfirmText === "DELETE";

  const {
    data: accountData,
    mutate: mutateAccountStatus,
    isLoading: isAccountStatusLoading,
    error: accountSwrError,
  } = useSWR("/api/account/status", fetcher);
  const {
    data: usageData,
    mutate: mutateUsage,
    isLoading: isUsageLoading,
  } = useSWR("/api/account/usage", fetcher);
  const { mutate: mutateOnboarding } = useSWR(
    "/api/onboarding/status?kick=true",
    fetcher,
  );

  const accountStatus = accountData?.account as AccountStatus | undefined;
  const accountStatusError =
    accountData?.error || accountSwrError?.message || "";
  const isAccountStatusInitialized =
    accountData !== undefined ||
    accountSwrError !== undefined ||
    (!isAccountStatusLoading && accountStatusError !== "");

  const usage = usageData as AccountUsage | undefined;
  const usageError = usageData?.message || usageData?.error || "";

  function runDojoNameRollEffect(): void {
    setIsGeneratingName(true);
    if (generateNameResetTimerRef.current !== null) {
      window.clearTimeout(generateNameResetTimerRef.current);
    }
    generateNameResetTimerRef.current = window.setTimeout(() => {
      setIsGeneratingName(false);
      generateNameResetTimerRef.current = null;
    }, DOJO_TITLE_ROLL_EFFECT_MS);
  }

  useEffect(() => {
    if (
      accountData?.error &&
      String(accountData.error).toLowerCase().includes("unauthorized")
    ) {
      router.push("/api/auth/signin");
    } else if (accountStatus && !fullName) {
      setFullName(
        getOnboardingPrefillName(
          accountStatus.displayName,
          accountStatus.prefillName,
        ),
      );
    }
  }, [accountData, accountStatus, fullName, router]);

  useEffect(() => {
    if (searchParams.get("success") === "linked") {
      setMessage({
        text: "Google account linked. Your guest profile has been upgraded without losing any data.",
        type: "success",
      });
      mutateAccountStatus();
      mutateOnboarding();
    } else if (searchParams.get("error") === "link_failed") {
      setMessage({
        text: "Failed to link your Google account. Please try again.",
        type: "error",
      });
    }
  }, [searchParams, mutateAccountStatus, mutateOnboarding]);

  useEffect(() => {
    return () => {
      if (generateNameResetTimerRef.current !== null) {
        window.clearTimeout(generateNameResetTimerRef.current);
      }
    };
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const validation = validateFullName(fullName);
    if (!validation.ok) {
      setMessage({ text: validation.error, type: "error" });
      return;
    }

    setIsSavingName(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: validation.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: data.error || "Failed to update full name.",
          type: "error",
        });
        return;
      }

      setFullName(data.account?.displayName || validation.value);
      mutateAccountStatus();
      setMessage({ text: "Full name updated successfully.", type: "success" });
    } catch {
      setMessage({
        text: "An unexpected error occurred while updating your full name.",
        type: "error",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveKey = async (
    e: React.FormEvent,
    provider: "anthropic" | "openrouter",
  ) => {
    e.preventDefault();
    setIsSavingKey(true);
    setMessage(null);
    setApiKeyFieldErrors((prev) => ({ ...prev, [provider]: "" }));
    const apiKey =
      provider === "anthropic"
        ? anthropicApiKey.trim()
        : openRouterApiKey.trim();

    try {
      const res = await fetch("/api/auth/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, provider }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "API key saved successfully.", type: "success" });
        if (provider === "anthropic") {
          setAnthropicApiKey("");
        } else {
          setOpenRouterApiKey("");
        }
        mutateAccountStatus();
      } else {
        if (data.code === "apikey_config_error") {
          setApiKeyFieldErrors((prev) => ({
            ...prev,
            [provider]:
              "Secure key storage is temporarily unavailable. Your key was not saved. Please try again later.",
          }));
        } else {
          setApiKeyFieldErrors((prev) => ({
            ...prev,
            [provider]: data.error || "Failed to save API key.",
          }));
        }
      }
    } catch {
      setApiKeyFieldErrors((prev) => ({
        ...prev,
        [provider]: "An unexpected error occurred while saving API key.",
      }));
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async (provider: "anthropic" | "openrouter") => {
    setIsRemovingKey(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/auth/apikey?provider=${provider}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: data.error || "Failed to remove API key.",
          type: "error",
        });
        return;
      }
      setMessage({ text: "API key removed.", type: "success" });
      setApiKeyFieldErrors((prev) => ({ ...prev, [provider]: "" }));
      mutateAccountStatus();
    } catch {
      setMessage({
        text: "An unexpected error occurred while removing API key.",
        type: "error",
      });
    } finally {
      setIsRemovingKey(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isDeletePhraseValid) return;

    setIsDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (res.ok) {
        await performSignOut();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          text: data.error || "Failed to delete account.",
          type: "error",
        });
        setDeleteDialogOpen(false);
      }
    } catch {
      setMessage({
        text: "An unexpected error occurred while deleting your account.",
        type: "error",
      });
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLinkGoogle = async () => {
    const result = await startGuestGoogleUpgrade(window.location.origin);
    if (!result.ok) {
      setMessage({
        text: `Failed to link account: ${result.error}`,
        type: "error",
      });
    }
  };

  const handleGuestUpgradeFromDialog = async () => {
    setIsUpgrading(true);
    const result = await startGuestGoogleUpgrade(window.location.origin);
    if (!result.ok) {
      setMessage({
        text: `Failed to link account: ${result.error}`,
        type: "error",
      });
      setIsUpgrading(false);
      setGuestLogoutOpen(false);
    }
    // On success the page redirects via OAuth
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await performSignOut();
  };

  const handleSignOutClick = () => {
    if (isGuest) {
      setGuestLogoutOpen(true);
    } else {
      setGoogleLogoutOpen(true);
    }
  };

  const isGuest = Boolean(accountStatus?.isGuest);

  const normalizedCurrentName = useMemo(
    () => (accountStatus?.displayName ?? "").trim(),
    [accountStatus?.displayName],
  );
  const normalizedInputName = useMemo(
    () => fullName.trim().replace(/\s+/g, " "),
    [fullName],
  );
  const canSaveAnthropicApiKey = useMemo(
    () => canSaveProviderApiKey("anthropic", anthropicApiKey),
    [anthropicApiKey],
  );
  const canSaveOpenRouterApiKey = useMemo(
    () => canSaveProviderApiKey("openrouter", openRouterApiKey),
    [openRouterApiKey],
  );
  const isNameDirty = normalizedInputName !== normalizedCurrentName;
  const hasAnthropicApiKey = Boolean(
    accountStatus?.hasProviderKey?.anthropic,
  );
  const hasOpenRouterApiKey = Boolean(
    accountStatus?.hasProviderKey?.openrouter,
  );
  const hasSavedAnthropicKey = shouldShowRemoveApiKey(hasAnthropicApiKey);
  const hasSavedOpenRouterKey = shouldShowRemoveApiKey(hasOpenRouterApiKey);

  const formatMicrousd = useCallback(
    (microusd: number) => `$${(microusd / 1_000_000).toFixed(4)}`,
    [],
  );
  const formatProviderName = useCallback((provider: string) => {
    const normalized = provider.trim().toLowerCase();
    if (normalized === "openrouter") {
      return "OpenRouter";
    }
    if (normalized === "n-traffic" || normalized === "ntraffic") {
      return "N-Traffic";
    }
    if (normalized === "anthropic") {
      return "Anthropic";
    }
    return provider
      .split(/[_-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }, []);
  const glassCardClass =
    "border-white/10 bg-[linear-gradient(150deg,hsl(var(--surface)/0.9),hsl(var(--surface)/0.62))] backdrop-blur-xl shadow-[0_12px_30px_-22px_hsl(var(--streak)/0.75)]";
  const glassInsetClass =
    "rounded-xl border border-white/10 bg-white/[0.03] p-3";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-10 sm:px-5 lg:px-7">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(130deg,hsl(var(--surface)/0.95),hsl(var(--surface)/0.65))] p-6 shadow-[0_24px_60px_-40px_hsl(var(--streak)/0.95)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-streak/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-36 w-36 rounded-full bg-plan/20 blur-3xl" />
        <div className="relative space-y-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Account Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Keep your profile, access, and account safety in one clean place.
            </p>
          </div>
        </div>
      </div>

      {!isAccountStatusInitialized ? (
        <SettingsSkeleton />
      ) : (
        <>
          {message && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm backdrop-blur-sm ${
                message.type === "success"
                  ? "border-success/30 bg-success/10 text-success shadow-[0_10px_26px_-22px_hsl(var(--success)/0.8)]"
                  : "border-danger/30 bg-danger/10 text-danger shadow-[0_10px_26px_-22px_hsl(var(--danger)/0.8)]"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* ── Session card ── */}
          {isAccountStatusInitialized && (
            <Card
              className={
                isGuest
                  ? "border-streak/30 bg-[linear-gradient(150deg,hsl(var(--streak)/0.13),hsl(var(--surface)/0.72))] shadow-glow-streak backdrop-blur-xl"
                  : glassCardClass
              }
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-streak" />
                    {isGuest ? "Guest Session" : "Your Account"}
                  </CardTitle>
                </div>
                <CardDescription>
                  {isGuest
                    ? "You're browsing as a guest. Your progress is saved temporarily — it will be lost if you sign out without linking Google."
                    : accountStatus?.displayName
                      ? `Signed in as ${accountStatus.displayName}.`
                      : "Signed in with Google."}
                </CardDescription>
                {isGuest && <GuestExpiryBanner variant="banner" onSignOut={handleSignOutClick} />}
              </CardHeader>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            <Card className={glassCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-plan" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Set the name used across your workspace and coach context.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={handleSaveName} className="space-y-2.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="fullName"
                      className="text-sm font-medium text-foreground"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g., Ada Lovelace"
                        maxLength={80}
                        disabled={isSavingName}
                        className={cn(
                          "bg-elevated/50 pr-[9.5rem] transition-all duration-300 sm:pr-[10.5rem]",
                          isGeneratingName &&
                            "border-primary/60 shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]",
                        )}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={cn(
                          "absolute bottom-1 right-1 top-1 h-auto border border-border/70 bg-surface px-2.5 text-xs shadow-none transition-transform duration-200 hover:bg-surface/95 sm:px-3",
                          isGeneratingName && "scale-[1.03]",
                        )}
                        disabled={isSavingName}
                        aria-label="Generate a random dojo name"
                        title="Generate a random dojo name"
                        onClick={() => {
                          setFullName(generateDojoTitlePhrase());
                          runDojoNameRollEffect();
                        }}
                      >
                        <Dice5
                          className={cn(
                            "h-3.5 w-3.5",
                            isGeneratingName && "animate-spin",
                          )}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">
                          Generate Dojo Name
                        </span>
                        <span className="sm:hidden">Generate</span>
                      </Button>
                    </div>
                    <p className="sr-only" aria-live="polite">
                      {isGeneratingName ? "New dojo name generated." : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="submit"
                      disabled={isSavingName || !isNameDirty}
                      className="w-full sm:w-auto"
                    >
                      {isSavingName ? "Saving..." : "Save Full Name"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      This also updates your `profile.md` name line.
                    </span>
                  </div>
                </form>
              </CardContent>
            </Card>

          </div>

          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-coach" />
                Provider API Keys
              </CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  <span>
                    Security first: sensitive keys are protected before they
                    are saved.
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
                <p className="text-emerald-100">
                  <span className="mr-1.5 font-medium text-emerald-200">
                    How do we protect your key?
                  </span>
                  We encrypt it with AES-256-CBC before saving, never print it
                  in logs, and you can remove it at any time.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className={glassInsetClass}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound
                        className={cn(
                          "h-4 w-4",
                          hasSavedAnthropicKey
                            ? "text-emerald-300"
                            : "text-danger",
                        )}
                      />
                      Anthropic API Key
                      <span
                        className={cn(
                          "ml-1 inline-flex items-center gap-1.5 text-xs font-medium",
                          hasSavedAnthropicKey
                            ? "text-emerald-300"
                            : "text-danger",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            hasSavedAnthropicKey
                              ? "bg-emerald-300"
                              : "bg-danger",
                          )}
                        />
                        {hasSavedAnthropicKey ? "Key added" : "Key not added"}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Add your own Anthropic key to use Anthropic models in the
                      multi-provider chat stack.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Need a key?{" "}
                      <a
                        href="https://platform.claude.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Get your Anthropic API key
                      </a>
                    </p>
                    <form
                      onSubmit={(event) => handleSaveKey(event, "anthropic")}
                      className="space-y-3"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor="anthropicApiKey"
                          className="text-sm font-medium text-foreground"
                        >
                          API Key (sk-ant-...)
                        </label>
                        <div className="relative">
                          <Input
                            id="anthropicApiKey"
                            type="password"
                            value={anthropicApiKey}
                            onChange={(e) => {
                              setAnthropicApiKey(e.target.value);
                              if (apiKeyFieldErrors.anthropic) {
                                setApiKeyFieldErrors((prev) => ({
                                  ...prev,
                                  anthropic: "",
                                }));
                              }
                            }}
                            placeholder={
                              hasSavedAnthropicKey
                                ? "sk-ant-•••••••••••••••• (stored securely)"
                                : "Paste your Anthropic key"
                            }
                            className={cn(
                              "bg-elevated/50",
                              hasSavedAnthropicKey && "pr-[7.25rem]",
                            )}
                            required
                            disabled={isSavingKey}
                          />
                          {hasSavedAnthropicKey && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRemoveKey("anthropic")}
                              disabled={isSavingKey || isRemovingKey}
                              className="absolute bottom-1 right-1 top-1 h-auto border border-border/70 bg-surface px-2.5 text-xs shadow-none transition-colors hover:bg-surface/95"
                            >
                              {isRemovingKey ? "Removing..." : "Remove Key"}
                            </Button>
                          )}
                        </div>
                        {apiKeyFieldErrors.anthropic && (
                          <p className="text-xs text-danger" role="alert">
                            {apiKeyFieldErrors.anthropic}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                          type="submit"
                          disabled={
                            !canSaveAnthropicApiKey ||
                            isSavingKey ||
                            isRemovingKey
                          }
                          className="w-full sm:w-auto"
                        >
                          {isSavingKey
                            ? "Storing Securely..."
                            : "Store Securely (AES-256-CBC)"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className={glassInsetClass}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound
                        className={cn(
                          "h-4 w-4",
                          hasSavedOpenRouterKey
                            ? "text-emerald-300"
                            : "text-danger",
                        )}
                      />
                      OpenRouter API Key
                      <span
                        className={cn(
                          "ml-1 inline-flex items-center gap-1.5 text-xs font-medium",
                          hasSavedOpenRouterKey
                            ? "text-emerald-300"
                            : "text-danger",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            hasSavedOpenRouterKey
                              ? "bg-emerald-300"
                              : "bg-danger",
                          )}
                        />
                        {hasSavedOpenRouterKey ? "Key added" : "Key not added"}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Add your own OpenRouter key to unlock paid OpenRouter
                      models.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Need a key?{" "}
                      <a
                        href="https://openrouter.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Get your OpenRouter API key
                      </a>
                    </p>
                    <form
                      onSubmit={(event) => handleSaveKey(event, "openrouter")}
                      className="space-y-3"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor="openRouterApiKey"
                          className="text-sm font-medium text-foreground"
                        >
                          API Key (sk-or-...)
                        </label>
                        <div className="relative">
                          <Input
                            id="openRouterApiKey"
                            type="password"
                            value={openRouterApiKey}
                            onChange={(e) => {
                              setOpenRouterApiKey(e.target.value);
                              if (apiKeyFieldErrors.openrouter) {
                                setApiKeyFieldErrors((prev) => ({
                                  ...prev,
                                  openrouter: "",
                                }));
                              }
                            }}
                            placeholder={
                              hasSavedOpenRouterKey
                                ? "sk-or-•••••••••••••••• (stored securely)"
                                : "Paste your OpenRouter key"
                            }
                            className={cn(
                              "bg-elevated/50",
                              hasSavedOpenRouterKey && "pr-[7.25rem]",
                            )}
                            required
                            disabled={isSavingKey}
                          />
                          {hasSavedOpenRouterKey && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRemoveKey("openrouter")}
                              disabled={isSavingKey || isRemovingKey}
                              className="absolute bottom-1 right-1 top-1 h-auto border border-border/70 bg-surface px-2.5 text-xs shadow-none transition-colors hover:bg-surface/95"
                            >
                              {isRemovingKey ? "Removing..." : "Remove Key"}
                            </Button>
                          )}
                        </div>
                        {apiKeyFieldErrors.openrouter && (
                          <p className="text-xs text-danger" role="alert">
                            {apiKeyFieldErrors.openrouter}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                          type="submit"
                          disabled={
                            !canSaveOpenRouterApiKey ||
                            isSavingKey ||
                            isRemovingKey
                          }
                          className="w-full sm:w-auto"
                        >
                          {isSavingKey
                            ? "Storing Securely..."
                            : "Store Securely (AES-256-CBC)"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className={cn(glassCardClass, "xl:col-span-8")}>
              <CardHeader>
                <CardTitle>Chat Usage Metrics</CardTitle>
                <CardDescription>
                  Session and account usage telemetry aggregated from your chat
                  history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isUsageLoading ? (
                  <p className="text-muted-foreground">
                    Loading usage metrics...
                  </p>
                ) : usageError ? (
                  <p className="text-danger">{usageError}</p>
                ) : usage ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className={glassInsetClass}>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Last 7 days
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {usage.trailing7Days.totalTokens.toLocaleString()}{" "}
                          tokens
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border border-sky-400/25 bg-sky-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-sky-200/80">
                              Input
                            </p>
                            <p className="mt-0.5 font-semibold text-sky-100">
                              {usage.trailing7Days.inputTokens.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">
                              Output
                            </p>
                            <p className="mt-0.5 font-semibold text-amber-100">
                              {usage.trailing7Days.outputTokens.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">
                              Total Tokens
                            </p>
                            <p className="mt-0.5 font-semibold text-emerald-100">
                              {usage.trailing7Days.totalTokens.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1">
                          Estimated cost:{" "}
                          {formatMicrousd(
                            usage.trailing7Days.estimatedCostMicrousd,
                          )}
                        </p>
                      </div>
                      <div className={glassInsetClass}>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Lifetime
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {usage.lifetime.totalTokens.toLocaleString()} tokens
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border border-sky-400/25 bg-sky-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-sky-200/80">
                              Input
                            </p>
                            <p className="mt-0.5 font-semibold text-sky-100">
                              {usage.lifetime.inputTokens.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">
                              Output
                            </p>
                            <p className="mt-0.5 font-semibold text-amber-100">
                              {usage.lifetime.outputTokens.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">
                              Total Tokens
                            </p>
                            <p className="mt-0.5 font-semibold text-emerald-100">
                              {usage.lifetime.totalTokens.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1">
                          Estimated cost:{" "}
                          {formatMicrousd(usage.lifetime.estimatedCostMicrousd)}
                        </p>
                      </div>
                    </div>
                    <div className={glassInsetClass}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Provider breakdown
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {usage.providerBreakdown.length} provider
                          {usage.providerBreakdown.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      {usage.providerBreakdown.length === 0 ? (
                        <p className="text-muted-foreground">
                          No provider usage yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {usage.providerBreakdown
                            .slice()
                            .sort((a, b) => b.totalTokens - a.totalTokens)
                            .map((provider) => (
                              <div
                                key={provider.provider}
                                className="rounded-lg border border-white/12 bg-[linear-gradient(110deg,hsl(var(--surface)/0.72),hsl(var(--surface)/0.52))] px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-foreground">
                                    {formatProviderName(provider.provider)}
                                  </p>
                                  <p className="text-xs text-emerald-200/90">
                                    Estimated cost:{" "}
                                    {formatMicrousd(
                                      provider.estimatedCostMicrousd,
                                    )}
                                  </p>
                                </div>
                                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                                  <p className="text-muted-foreground">
                                    Input:{" "}
                                    <span className="font-semibold text-sky-100">
                                      {provider.inputTokens.toLocaleString()}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Output:{" "}
                                    <span className="font-semibold text-amber-100">
                                      {provider.outputTokens.toLocaleString()}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Total Tokens:{" "}
                                    <span className="font-semibold text-emerald-100">
                                      {provider.totalTokens.toLocaleString()}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No usage metrics yet.</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => mutateUsage()}
                    disabled={isUsageLoading}
                    className="w-full sm:w-auto"
                  >
                    {isUsageLoading ? "Refreshing..." : "Refresh Usage"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-danger/45 bg-[linear-gradient(170deg,hsl(var(--danger)/0.15),hsl(var(--danger)/0.08))] backdrop-blur-xl xl:sticky xl:top-6 xl:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger">
                  <ShieldAlert className="h-4 w-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data. This
                  action is irreversible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>

          <GuestLogoutDialog
            open={guestLogoutOpen}
            onOpenChange={setGuestLogoutOpen}
            onUpgrade={handleGuestUpgradeFromDialog}
            onSignOut={handleSignOut}
            isUpgrading={isUpgrading}
            isSigningOut={isLoggingOut}
          />
          <LogoutConfirmDialog
            open={googleLogoutOpen}
            onOpenChange={setGoogleLogoutOpen}
            onSignOut={handleSignOut}
            isSigningOut={isLoggingOut}
            displayName={accountStatus?.displayName ?? undefined}
          />
          <Dialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setDeleteConfirmText("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Account Deletion</DialogTitle>
                <DialogDescription>
                  This will permanently remove your profile, memory files,
                  chats, progress, and auth account. Type{" "}
                  <code className="px-1 py-0.5 rounded bg-elevated text-foreground">
                    DELETE
                  </code>{" "}
                  to confirm.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <label
                  htmlFor="deleteConfirm"
                  className="text-sm font-medium text-foreground"
                >
                  Type DELETE to continue
                </label>
                <Input
                  id="deleteConfirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="bg-elevated/50"
                  autoComplete="off"
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={!isDeletePhraseValid || isDeleting}
                >
                  {isDeleting ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete Account"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

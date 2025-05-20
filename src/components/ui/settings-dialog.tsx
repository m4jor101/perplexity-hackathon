import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Button } from "./button";
import { Icon } from "@iconify/react";
import { Settings, loadSettings, saveSettings } from "../../lib/storage";
import { cn } from "../../lib/utils";

type Theme = 'light' | 'dark' | 'system';

export function SettingsDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = React.useState("");
  const [theme, setTheme] = React.useState<Theme>('system');

  React.useEffect(() => {
    loadSettings().then((settings: Settings) => {
      if (settings.perplexityApiKey) {
        setPerplexityApiKey(settings.perplexityApiKey);
      }
      if (settings.theme) {
        setTheme(settings.theme);
      }
    });
  }, []);

  const handleSave = async () => {
    await saveSettings({
      perplexityApiKey,
      theme
    });

    setIsOpen(false);

    // Apply theme
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', systemPrefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    window.location.reload();
  };

  const ThemeOption = ({ value, icon, label }: { value: Theme, icon: React.ReactNode, label: string }) => (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
        theme === value
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={() => setTheme(value)}
    >
      {icon}
      <span>{label}</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Icon icon="material-symbols:settings" className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          {/* API Key Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="perplexityApiKey" className="text-sm font-semibold text-foreground">
                Perplexity API Key
              </label>
              <a
                href="https://www.perplexity.ai/account/api/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-foreground"
              >
                Get key <Icon icon="material-symbols:open-in-new" className="h-3 w-3 ml-1" />
              </a>
            </div>
            <input
              id="perplexityApiKey"
              type="password"
              value={perplexityApiKey}
              onChange={(e) => setPerplexityApiKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background border-input focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              placeholder="Your Perplexity API key..."
            />
          </div>

          {/* Theme Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none text-foreground">
              Theme
            </label>
            <div className="flex flex-col space-y-1 mt-1.5 border border-border rounded-md overflow-hidden">
              <ThemeOption
                value="light"
                icon={<Icon icon="material-symbols:light-mode" className="h-4 w-4" />}
                label="Light"
              />
              <ThemeOption
                value="dark"
                icon={<Icon icon="material-symbols:dark-mode" className="h-4 w-4" />}
                label="Dark"
              />
              <ThemeOption
                value="system"
                icon={<Icon icon="material-symbols:desktop-windows" className="h-4 w-4" />}
                label="System"
              />
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <Button onClick={handleSave} className="w-full sm:w-auto">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
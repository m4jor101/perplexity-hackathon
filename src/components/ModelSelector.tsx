import React, { useState } from 'react';
import { Button } from './ui/button';
import { Icon } from '@iconify/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { cn } from '../lib/utils';
import { type Model } from '../lib/models';

type ModelSelectorProps = {
  selectedModel: Model;
  models: Model[];
  onModelChange: (model: Model) => void;
};

export function ModelSelector({ selectedModel, models, onModelChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const groupedModels = {
    research: models.filter(m => m.capability === "research"),
    reasoning: models.filter(m => m.capability === "reasoning"),
    basic: models.filter(m => m.capability === "basic")
  };

  const getCapabilityIcon = (capability: string) => {
    switch (capability) {
      case 'research': return "ph:books-bold";
      case 'reasoning': return "ph:brain-bold";
      case 'basic': return "ph:lightning-bold";
    }
  };

  const getCapabilityTitle = (capability: string) => {
    switch (capability) {
      case 'research': return "Research Models";
      case 'reasoning': return "Reasoning Models";
      case 'basic': return "Basic Models";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 bg-primary/5 border-0 font-medium hover:bg-primary/10"
        >
          <Icon
            icon={getCapabilityIcon(selectedModel?.capability || 'basic')}
            className="h-4 w-4 text-primary"
          />
          <span className="text-foreground">{selectedModel?.name}</span>
          <Icon
            icon="material-symbols:keyboard-arrow-down"
            className="h-4 w-4 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-2" align="start">
        {(['research', 'reasoning', 'basic'] as const).map(capability => (
          groupedModels[capability].length > 0 && (
            <div key={capability} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <Icon
                  icon={getCapabilityIcon(capability)}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {getCapabilityTitle(capability)}
                </span>
              </div>
              <div className="space-y-1">
                {groupedModels[capability].map((model) => (
                  <Button
                    key={model.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start px-2 py-3 h-auto gap-3",
                      selectedModel?.id === model.id && "bg-primary/5 hover:bg-primary/10"
                    )}
                    onClick={() => {
                      onModelChange(model);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                      </div>
                    </div>
                    <div className="ml-auto pl-2 text-right">
                      <div className="text-[10px] tabular-nums">
                        <div className="text-primary">IN: {model.pricing.input}/1K</div>
                        <div className="text-primary">OUT: {model.pricing.output}/1K</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )
        ))}
      </PopoverContent>
    </Popover>
  );
}
import { useGT } from "gt-react";
import { type ComponentType, createContext, useContext } from "react";

import { cn } from "~/lib/utils";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface NewTabTool {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly available: boolean;
  readonly disabledReason?: string;
  readonly onSelect: () => void;
}

/** Set by the tab strip while its active tab is an empty browser tab. */
export const NewTabToolsContext = createContext<ReadonlyArray<NewTabTool> | null>(null);

/** An empty browser tab can become another surface instead, in the same place. */
export function NewTabTools() {
  const gt = useGT();
  const tools = useContext(NewTabToolsContext);
  if (!tools || tools.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={gt("Open something else")}>
      <h2 className="text-sm font-medium text-muted-foreground">{gt("Open something else")}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const content = (
            <>
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{tool.label}</span>
            </>
          );
          const className =
            "flex h-9 w-full items-center gap-2.5 rounded-lg border border-border px-3 text-left text-sm";
          return tool.available ? (
            <button
              key={tool.id}
              type="button"
              data-new-tab-tool={tool.id}
              className={cn(className, "cursor-pointer transition-colors hover:bg-accent/60")}
              onClick={tool.onSelect}
            >
              {content}
            </button>
          ) : (
            <Tooltip key={tool.id}>
              <TooltipTrigger
                render={
                  <div
                    tabIndex={0}
                    aria-disabled="true"
                    data-new-tab-tool={tool.id}
                    className={cn(className, "cursor-default opacity-50")}
                  />
                }
              >
                {content}
              </TooltipTrigger>
              {tool.disabledReason ? (
                <TooltipPopup side="top">{tool.disabledReason}</TooltipPopup>
              ) : null}
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}

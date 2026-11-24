import { useGT } from "gt-react";

import type { AddressEntryItem } from "~/pins/useAddressEntry";

import { Command, CommandGroup, CommandItem, CommandList } from "../ui/command";
import { ComposerBanner } from "./ComposerBanner";

/** The new-session composer's suggestions: open the address, ask, search, or jump to a tab. */
export function AddressEntryMenu(props: {
  items: ReadonlyArray<AddressEntryItem>;
  activeIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (item: AddressEntryItem) => void;
}) {
  const gt = useGT();
  return (
    <Command autoHighlight={false} mode="none">
      <ComposerBanner.Surface
        className="flex min-h-0 w-full flex-col overflow-hidden pb-(--chat-composer-attachment-overlap) **:data-[slot=command-item]:rounded-lg"
        data-address-entry-menu
      >
        <CommandList aria-label={gt("Open or ask")} className="max-h-72 min-h-0 scroll-pb-6">
          <CommandGroup>
            {props.items.map((item, index) => (
              <CommandItem
                key={item.id}
                value={item.id}
                aria-selected={index === props.activeIndex}
                active={index === props.activeIndex}
                data-address-entry-item={item.id}
                onMouseMove={() => {
                  if (index !== props.activeIndex) props.onHighlight(index);
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => props.onSelect(item)}
              >
                {item.icon}
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 max-w-[60%] shrink-0 truncate text-xs font-medium">
                    {item.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-secondary-label text-xs">
                    {item.description}
                  </span>
                </span>
                {index === props.activeIndex ? (
                  <kbd className="text-secondary-label text-xs">↵</kbd>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </ComposerBanner.Surface>
    </Command>
  );
}

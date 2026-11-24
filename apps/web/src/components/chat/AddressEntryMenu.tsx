import { useGT } from "gt-react";

import type { AddressEntryItem } from "~/pins/useAddressEntry";

import { Command, CommandGroup, CommandItem, CommandList } from "../ui/command";

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
      <div
        className="absolute inset-x-0 top-full z-20 mt-2 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-lg **:data-[slot=command-item]:rounded-lg"
        data-address-entry-menu
      >
        <CommandList aria-label={gt("Open or ask")} className="max-h-72 min-h-0">
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
      </div>
    </Command>
  );
}

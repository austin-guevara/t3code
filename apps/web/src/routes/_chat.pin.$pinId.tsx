import { createFileRoute } from "@tanstack/react-router";

import { PinnedPageView } from "../pins/PinnedPageView";

export const Route = createFileRoute("/_chat/pin/$pinId")({
  component: function PinnedPageRoute() {
    const { pinId } = Route.useParams();
    return <PinnedPageView pinId={pinId} />;
  },
});

import type { Meta } from "@storybook/react";
import React from "react";

import { Citation } from "../index_with_tw_base";

const meta = {
  title: "Components/Citation",
  component: Citation,
} satisfies Meta<typeof Citation>;

export default meta;

export const CitationsExample = () => (
  <div className="s-flex s-flex-col s-gap-8">
    <div className="s-flex s-gap-2">
      <Citation
        title="With close action"
        size="xs"
        type="document"
        index="3"
        onClose={() => alert("Close action clicked")}
        isBlinking={true}
      />

      <Citation
        title="With avatarUrl"
        size="xs"
        type="document"
        onClose={() => alert("Close action clicked")}
        isBlinking={true}
        avatarUrl="https://cdn.discordapp.com/attachments/995248824375316560/1143857310142316685/duncid_friendly_Scandinavian_droid_designed_by_Wes_Anderson_and_29eec588-b898-4e4a-9776-10c27790cbf9.png"
      />
    </div>
    <div className="s-w-full">
      <div className="s-grid s-grid-cols-2 s-items-stretch s-gap-2 md:s-grid-cols-3 lg:s-grid-cols-4">
        <Citation
          title="Source: Thread on #general message from @ed"
          size="xs"
          sizing="fluid"
          type="slack"
          index="1"
          href="https://www.google.com"
        />
        <Citation
          title="Title"
          type="github"
          size="xs"
          sizing="fluid"
          index="2"
          href="https://www.google.com"
        />
        <Citation
          title="Source: Thread on #general message from @ed"
          size="xs"
          sizing="fluid"
          type="slack"
          index="1"
          href="https://www.google.com"
        />
        <Citation
          title="Title"
          type="github"
          size="xs"
          sizing="fluid"
          index="2"
          href="https://www.google.com"
        />
        <Citation
          title="Source: Thread on #general message from @ed"
          size="xs"
          sizing="fluid"
          type="slack"
          index="1"
          href="https://www.google.com"
        />
        <Citation
          title="Title"
          type="github"
          sizing="fluid"
          size="xs"
          index="2"
          href="https://www.google.com"
        />
      </div>
    </div>
    <div className="s-flex s-gap-2">
      <Citation
        title="Source: Thread on #general message from @ed"
        size="xs"
        type="slack"
        index="1"
        href="https://www.google.com"
      />
      <Citation
        title="Title"
        type="github"
        size="xs"
        index="2"
        href="https://www.google.com"
      />
    </div>
    <Citation
      title="Source: Thread on #general"
      type="slack"
      href="https://www.google.com"
    />
    <div className="s-flex s-gap-2">
      <Citation
        title="Title"
        type="google_drive"
        index="3"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={true}
      />
      <Citation
        title="Awesome article"
        type="intercom"
        index="3"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={false}
      />
    </div>
    <div className="s-flex s-gap-2">
      <Citation
        title="With close action"
        type="document"
        index="3"
        onClose={() => alert("Close action clicked")}
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={true}
      />

      <Citation
        title="With avatarUrl"
        type="document"
        onClose={() => alert("Close action clicked")}
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={true}
        avatarUrl="https://cdn.discordapp.com/attachments/995248824375316560/1143857310142316685/duncid_friendly_Scandinavian_droid_designed_by_Wes_Anderson_and_29eec588-b898-4e4a-9776-10c27790cbf9.png"
      />
    </div>
    <div className="s-flex s-gap-2">
      <Citation
        title="Source: Thread on #general message from @ed"
        type="slack"
        index="1"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
      />
      <Citation
        title="Title"
        type="github"
        index="2"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
      />
    </div>
    <div className="s-flex s-gap-2">
      <Citation
        title="Title"
        type="google_drive"
        index="3"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={true}
      />
      <Citation
        title="Awesome article"
        type="intercom"
        index="3"
        href="https://www.google.com"
        description="Write a 120 character description of the citation here to be displayed in the citation list."
        isBlinking={false}
      />
    </div>
  </div>
);

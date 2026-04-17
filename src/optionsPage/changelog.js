// Changelog data for Mockzilla
export const changelogData = {
  "1.0": {
    title: "Version 1.0: Official Release",
    date: "April 2026",
    sections: [
      {
        title: "🚀 New Features",
        items: [
          "**Official 1.0 Release**: Mockzilla is now stable and ready for production!",
          "**Server Side Upgraded**: Go to our new landing page version with a new design and better documentation! [mockzilla.dev](https://mockzilla.dev?utm_source=extension&utm_medium=changelog&utm_campaign=v1.0) ",
          "**Folder Management**: Renamed 'Groups' to 'Folders' and improved the organization UI for better clarity.",
          "**Enhanced Server Sync**: Server Sync is now out of BETA. Added Push and Pull functionality for seamless rule synchronization.",
        ]
      },
      {
        title: "🚀 Improvements",
        items: [
          "**Rule Export/Import**: Improved deduplication and validation when importing or exporting rules.",
          "**UI/UX Polish**: Enhanced the rule details UI with better URL pattern handling and response body fields.",
          "**Consistency**: Standardized terminology across the app (Folders, Sync, etc.) and improved UI feedback.",
        ]
      }
    ]
  },
  "0.4": {
    title: "Version 0.4: Capture Panel",
    date: "January 2026",
    sections: [
      {
        title: "🚀 New Features",
        items: [
          "**Capture Panel**: Now it's easier to debug the mock rules that were used directly in your page.",
        ]
      },
      {
        title: "🚀 Improvements",
        items: [
          "**Under the hood**: Now using [MSW (Mock Service Worker)](https://mswjs.io/) interceptors for more reliable request handling.",
        ]
      }
    ]
  },
  "0.3": {
    title: "Version 0.3: Server Sync & UI Refresh",
    date: "January 2026",
    sections: [
      {
        title: "🚀 New Features",
        items: [
          "**Server Sync (BETA)**: Sync your rules to a Mockzilla server for team collaboration. [Learn more here](https://mockzilla.dev/docs#extension-sync?utm_source=extension&utm_medium=changelog&utm_campaign=v0.3)",
          "**Settings**: Created a new Settings Modal UI to import, export rules and sync to server!",
          "**Contact Form**: Created a new Contact Form to send feedback to the developer aside Settings",
      ]
      }
    ]
  }
};

export const getChangelog = (version) => changelogData[version] || null;

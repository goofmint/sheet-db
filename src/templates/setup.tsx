import { SetupHeader } from './setup/header';
import { Messages } from './setup/messages';
import { AuthSection } from './setup/auth-section';
import { StatusDisplay } from './setup/status-display';
import { SetupForm } from './setup/setup-form';

export default function SetupTemplate() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SheetDB Setup</title>
        <link rel="stylesheet" href="/statics/setup/style.css" />
      </head>
      <body>
        <div className="container">
          <SetupHeader />
          <main>
            <Messages />
            <AuthSection />
            <StatusDisplay />
            <SetupForm />
          </main>
        </div>
        <script src="/statics/setup/app.js"></script>
      </body>
    </html>
  );
}
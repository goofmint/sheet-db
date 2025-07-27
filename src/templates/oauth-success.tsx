interface OAuthSuccessProps {
  token: string;
}

export default function OAuthSuccessTemplate({ token }: OAuthSuccessProps) {
  return (
    <html>
      <head>
        <title>Authentication Success</title>
      </head>
      <body>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.opener.postMessage({
              type: 'google-auth-success',
              token: '${token}'
            }, window.location.origin);
            window.close();
          `
        }} />
      </body>
    </html>
  );
}
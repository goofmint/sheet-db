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
        <div id="auth-token" style="display: none;" data-token={token}></div>
        <script dangerouslySetInnerHTML={{
          __html: `
            const tokenElement = document.getElementById('auth-token');
            const token = tokenElement.dataset.token;
            
            window.opener.postMessage({
              type: 'google-auth-success',
              token: token
            }, window.location.origin);
            window.close();
          `
        }} />
      </body>
    </html>
  );
}
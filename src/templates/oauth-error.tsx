interface ErrorPageProps {
  title: string;
  message: string;
}

export default function ErrorPageTemplate({ title, message }: ErrorPageProps) {
  return (
    <html>
      <head>
        <title>{title}</title>
        <style>{`
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .error-container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
          }
          .error-icon {
            font-size: 48px;
            color: #dc3545;
            margin-bottom: 20px;
          }
          .error-title {
            color: #dc3545;
            margin-bottom: 20px;
            font-size: 24px;
          }
          .error-message {
            color: #6c757d;
            line-height: 1.5;
            margin-bottom: 30px;
          }
          .close-button {
            background-color: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          .close-button:hover {
            background-color: #5a6268;
          }
        `}</style>
      </head>
      <body>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h1 className="error-title">{title}</h1>
          <p className="error-message">{message}</p>
          <button className="close-button" onclick="window.close()">
            Close Window
          </button>
        </div>
      </body>
    </html>
  );
}
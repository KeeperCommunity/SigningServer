export const EMAIL_TEMPLATES = {
  IKS_SETUP: `
  <!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Inheritance Key Setup Confirmation</title>
    <style media="all" type="text/css">
      body {
        font-family: Helvetica, sans-serif;
        -webkit-font-smoothing: antialiased;
        font-size: 16px;
        line-height: 1.3;
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
        background-color: #f4f5f6;
        margin: 0;
        padding: 0;
      }
      table {
        border-collapse: separate;
        width: 100%;
      }
      table td {
        font-family: Helvetica, sans-serif;
        font-size: 16px;
        vertical-align: top;
      }
      .container {
        margin: 0 auto !important;
        max-width: 600px;
        padding: 24px 0;
        width: 100%;
      }
      .content {
        display: block;
        margin: 0 auto;
        max-width: 600px;
      }
      .main {
        background: #FFF8ED;
        border: 1px solid #eaebed;
        border-radius: 16px;
        width: 100%;
      }
      .wrapper {
        box-sizing: border-box;
        padding-top: 8px;
        padding-left: 24px;
        padding-right: 24px;
        padding-bottom: 24px;
      }
      .footer {
        clear: both;
        padding-top: 24px;
        text-align: center;
        width: 100%;
      }
      .footer td,
      .footer p,
      .footer span,
      .footer a {
        color: #9a9ea6;
        font-size: 16px;
        text-align: center;
      }
      p {
        font-family: Helvetica, sans-serif;
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        margin-bottom: 16px;
      }
      a {
        color: #0867ec;
        text-decoration: underline;
      }
      .header {
        background-color: #FFF8ED;
        padding: 16px;
        text-align: left;
      }
      .header img {
        max-width: 150px;
      }
      @media only screen and (max-width: 640px) {
        .main p,
        .main td,
        .main span {
          font-size: 16px !important;
        }
        .wrapper {
          padding: 8px !important;
        }
        .container {
          padding: 0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }
        .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
      <tr>
        <td>&nbsp;</td>
        <td class="container">
          <div class="content">
            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main">
              <!-- START HEADER -->
              <tr>
                <td class="header">
                <img src="https://bitcoinkeeper.app/icons/keeper-logo.png" alt="Keeper Logo">
                <hr>
                </td>
              </tr>
              <!-- END HEADER -->
              
              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper">
                  <p>Dear Bitcoiner,</p>
                  <p>Your Inheritance Key has been setup successfully.</p>
                  <p>You will receive notification emails when your Inheritance Key is requested by a beneficiary. You will have the option to decline the key's use in the notification email.</p>
                  <p>If not declined for 30 days straight, the beneficiary will be able to use the key.</p>
                  
                  <p>Need help? Reach out to us via the in-app Concierge.</p>
                  <p>
                    Thank you for choosing Keeper.<br>
                    Kind Regards,<br>
                    Team Keeper.<br>
                    <a href="https://x.com/bitcoinkeeper_"><img src="https://bitcoinkeeper.app/icons/x.png" alt="X Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.youtube.com/channel/UCMqDNxbz16w8pxpmsa6s8GQ"><img src="https://bitcoinkeeper.app/icons/youtube.png" alt="Youtube Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.linkedin.com/company/bithyve/"><img src="https://bitcoinkeeper.app/icons/linkedin.png" alt="Linkedin Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://medium.com/bitbees"><img src="https://bitcoinkeeper.app/icons/medium.png" alt="Medium Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://t.me/bitcoinkeeper"><img src="https://bitcoinkeeper.app/icons/telegram.png" alt="Telegram Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://github.com/bithyve/"><img src="https://bitcoinkeeper.app/icons/github.png" alt="Github Logo" style="width: 15px; vertical-align: middle;"></a>
                  </p>
                </td>
              </tr>
              <!-- END MAIN CONTENT AREA -->
            </table>

            <!-- START FOOTER -->
            <div class="footer">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="content-block">
                    <span class="apple-link">Bithyve, London, United Kingdom</span>
                  </td>
                </tr>
              </table>
            </div>
            <!-- END FOOTER -->
            
          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`,
  IKS_REQUEST: `
  <!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Inheritance Key Request</title>
    <style media="all" type="text/css">
      body {
        font-family: fira-sans;
        -webkit-font-smoothing: antialiased;
        font-size: 16px;
        line-height: 1.3;
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
        background-color: #f4f5f6;
        margin: 0;
        padding: 0;
      }
      table {
        border-collapse: separate;
        width: 100%;
      }
      table td {
        font-family: fira-sans;
        font-size: 16px;
        vertical-align: top;
      }
      .container {
        margin: 0 auto !important;
        max-width: 600px;
        padding: 24px 0;
        width: 100%;
      }
      .content {
        display: block;
        margin: 0 auto;
        max-width: 600px;
      }
      .main {
        background: #FFF8ED;
        border: 1px solid #eaebed;
        border-radius: 16px;
        width: 100%;
      }
      .wrapper {
        box-sizing: border-box;
        padding-top: 8px;
        padding-left: 24px;
        padding-right: 24px;
        padding-bottom: 24px;
      }
      .footer {
        clear: both;
        padding-top: 24px;
        text-align: center;
        width: 100%;
      }
      .footer td,
      .footer p,
      .footer span,
      .footer a {
        color: #9a9ea6;
        font-size: 16px;
        text-align: center;
      }
      p {
        font-family: fira-sans;
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        margin-bottom: 16px;
      }
      a {
        color: #0867ec;
        text-decoration: underline;
      }
      .btn {
      box-sizing: border-box;
      min-width: 100% !important;
      width: 100%;
    }
    
    .btn > tbody > tr > td {
      padding-bottom: 16px;
    }
    
    .btn table {
      width: auto;
    }
    
    .btn table td {
      background-color: #ffffff;
      border-radius: 4px;
      text-align: center;
    }
    
    .btn button {
      background-color: #ffffff;
      border: solid 2px #036252;
      border-radius: 4px;
      box-sizing: border-box;
      color: #036252;
      cursor: pointer;
      display: inline-block;
      font-size: 16px;
      font-weight: bold;
      margin: 0;
      padding: 12px 24px;
      text-decoration: none;
      text-transform: capitalize;
    }
    
    .btn-primary table td {
      background-color: #036252;
    }
    
    .btn-primary button {
      background-color: #036252;
      border-color: #036252;
      color: #ffffff;
    }
    
    @media all {
      .btn-primary table td:hover {
        background-color: #057261 !important;
      }
      .btn-primary a:hover {
        background-color: #057261 !important;
        border-color: #057261 !important;
      }
    }
      .header {
        background-color: #FFF8ED;
        padding: 16px;
        text-align: left;
      }
      .header img {
        max-width: 150px;
      }
      @media only screen and (max-width: 640px) {
        .main p,
        .main td,
        .main span {
          font-size: 16px !important;
        }
        .wrapper {
          padding: 8px !important;
        }
        .container {
          padding: 0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }
        .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
      <tr>
        <td>&nbsp;</td>
        <td class="container">
          <div class="content">
            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main">
              <!-- START HEADER -->
              <tr>
                <td class="header">
                <img src="https://bitcoinkeeper.app/icons/keeper-logo.png" alt="Keeper Logo">                
                <hr>
                </td>
              </tr>
              <!-- END HEADER -->
              
              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper">
                  <body>
                    <p><b>Inheritance Key Request</b></p>
                    <p>Dear user, your Vault's Inheritance Key is being requested - {{requestId}}</p>
                    <p>Please press Decline to reject the request in order to avoid its auto approval in {{requestAutoApprovesIn}}.</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                      <tbody>
                        <tr>
                          <td align="center">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                              <tbody>
                                <tr><td><form action="{{server_url}}/v3/declineInheritanceKeyRequest" method="post">
                                  <input type="hidden" name="requestId" value={{requestId}}>
                                  <button type="submit">DECLINE</button>
                                </form></td></tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  <p>Need help? Reach out to us via the in-app Concierge.</p>
                  <p>
                    Thank you for choosing Keeper.<br>
                    Kind Regards,<br>
                    Team Keeper.<br>
                    <a href="https://x.com/bitcoinkeeper_"><img src="https://bitcoinkeeper.app/icons/x.png" alt="X Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.youtube.com/channel/UCMqDNxbz16w8pxpmsa6s8GQ"><img src="https://bitcoinkeeper.app/icons/youtube.png" alt="Youtube Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.linkedin.com/company/bithyve/"><img src="https://bitcoinkeeper.app/icons/linkedin.png" alt="Linkedin Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://medium.com/bitbees"><img src="https://bitcoinkeeper.app/icons/medium.png" alt="Medium Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://t.me/bitcoinkeeper"><img src="https://bitcoinkeeper.app/icons/telegram.png" alt="Telegram Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://github.com/bithyve/"><img src="https://bitcoinkeeper.app/icons/github.png" alt="Github Logo" style="width: 15px; vertical-align: middle;"></a>
                  </p>
                </td>
              </tr>
              <!-- END MAIN CONTENT AREA -->
            </table>

            <!-- START FOOTER -->
            <div class="footer">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="content-block">
                    <span class="apple-link">Bithyve, London, United Kingdom</span>
                  </td>
                </tr>
              </table>
            </div>
            <!-- END FOOTER -->
            
          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`,
  ONE_TIME_BACKUP: `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Inheritance Key Request</title>
    <style media="all" type="text/css">
      body {
        font-family: fira-sans;
        -webkit-font-smoothing: antialiased;
        font-size: 16px;
        line-height: 1.3;
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
        background-color: #f4f5f6;
        margin: 0;
        padding: 0;
      }
      table {
        border-collapse: separate;
        width: 100%;
      }
      table td {
        font-family: fira-sans;
        font-size: 16px;
        vertical-align: top;
      }
      .container {
        margin: 0 auto !important;
        max-width: 600px;
        padding: 24px 0;
        width: 100%;
      }
      .content {
        display: block;
        margin: 0 auto;
        max-width: 600px;
      }
      .main {
        background: #FFF8ED;
        border: 1px solid #eaebed;
        border-radius: 16px;
        width: 100%;
      }
      .wrapper {
        box-sizing: border-box;
        padding-top: 8px;
        padding-left: 24px;
        padding-right: 24px;
        padding-bottom: 24px;
      }
      .footer {
        clear: both;
        padding-top: 24px;
        text-align: center;
        width: 100%;
      }
      .footer td,
      .footer p,
      .footer span,
      .footer a {
        color: #9a9ea6;
        font-size: 16px;
        text-align: center;
      }
      p {
        font-family: fira-sans;
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        margin-bottom: 16px;
      }
      a {
        color: #0867ec;
        text-decoration: underline;
      }
      .btn {
      box-sizing: border-box;
      min-width: 100% !important;
      width: 100%;
    }
    
    .btn > tbody > tr > td {
      padding-bottom: 16px;
    }
    
    .btn table {
      width: auto;
    }
    
    .btn table td {
      background-color: #ffffff;
      border-radius: 4px;
      text-align: center;
    }
    
    .btn button {
      background-color: #ffffff;
      border: solid 2px #036252;
      border-radius: 4px;
      box-sizing: border-box;
      color: #036252;
      cursor: pointer;
      display: inline-block;
      font-size: 16px;
      font-family: fira-sans;
      font-weight: bold;
      margin: 0;
      padding: 12px 24px;
      text-decoration: none;
      text-transform: capitalize;
    }
    
    .btn-primary table td {
      background-color: #036252;
    }
    
    .btn-primary button {
      background-color: #036252;
      border-color: #036252;
      color: #ffffff;
    }
    
    @media all {
      .btn-primary table td:hover {
        background-color: #057261 !important;
      }
      .btn-primary a:hover {
        background-color: #057261 !important;
        border-color: #057261 !important;
      }
    }
      .header {
        background-color: #FFF8ED;
        padding: 16px;
        text-align: left;
      }
      .header img {
        max-width: 150px;
      }
      @media only screen and (max-width: 640px) {
        .main p,
        .main td,
        .main span {
          font-size: 16px !important;
        }
        .wrapper {
          padding: 8px !important;
        }
        .container {
          padding: 0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }
        .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
      <tr>
        <td>&nbsp;</td>
        <td class="container">
          <div class="content">
            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main">
              <!-- START HEADER -->
              <tr>
                <td class="header">
                <img src="https://bitcoinkeeper.app/icons/keeper-logo.png" alt="Keeper Logo">
                <hr>
                </td>
              </tr>
              <!-- END HEADER -->
              
              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper">
                  <body>
                    <p><b>Inheritance Key One Time Backup Request</b></p>
                    <p>Dear user, your Vault's Inheritance Key's one-time backup is being requested - {{requestId}}</p>
                    <p>Please press Decline to reject the request in order to avoid its auto approval in {{requestAutoApprovesIn}}.</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                      <tbody>
                        <tr>
                          <td align="center">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                              <tbody>
                                <tr><td><form action="{{server_url}}/v3/declineInheritanceKeyRequest" method="post">
                                  <input type="hidden" name="requestId" value={{requestId}}>
                                  <button type="submit">DECLINE</button>
                                </form></td></tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  <p>Need help? Reach out to us via the in-app Concierge.</p>
                  <p>
                    Thank you for choosing Keeper.<br>
                    Kind Regards,<br>
                    Team Keeper.<br>
                    <a href="https://x.com/bitcoinkeeper_"><img src="https://bitcoinkeeper.app/icons/x.png" alt="X Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.youtube.com/channel/UCMqDNxbz16w8pxpmsa6s8GQ"><img src="https://bitcoinkeeper.app/icons/youtube.png" alt="Youtube Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.linkedin.com/company/bithyve/"><img src="https://bitcoinkeeper.app/icons/linkedin.png" alt="Linkedin Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://medium.com/bitbees"><img src="https://bitcoinkeeper.app/icons/medium.png" alt="Medium Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://t.me/bitcoinkeeper"><img src="https://bitcoinkeeper.app/icons/telegram.png" alt="Telegram Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://github.com/bithyve/"><img src="https://bitcoinkeeper.app/icons/github.png" alt="Github Logo" style="width: 15px; vertical-align: middle;"></a>
                  </p>
                </td>
              </tr>
              <!-- END MAIN CONTENT AREA -->
            </table>

            <!-- START FOOTER -->
            <div class="footer">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="content-block">
                    <span class="apple-link">Bithyve, London, United Kingdom</span>
                  </td>
                </tr>
              </table>
            </div>
            <!-- END FOOTER -->
            
          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`,
  SIGN_TRANSACTION: `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Inheritance Key Signing Request</title>
    <style media="all" type="text/css">
      body {
        font-family: fira-sans;
        -webkit-font-smoothing: antialiased;
        font-size: 16px;
        line-height: 1.3;
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
        background-color: #f4f5f6;
        margin: 0;
        padding: 0;
      }
      table {
        border-collapse: separate;
        width: 100%;
      }
      table td {
        font-family: fira-sans;
        font-size: 16px;
        vertical-align: top;
      }
      .container {
        margin: 0 auto !important;
        max-width: 600px;
        padding: 24px 0;
        width: 100%;
      }
      .content {
        display: block;
        margin: 0 auto;
        max-width: 600px;
      }
      .main {
        background: #FFF8ED;
        border: 1px solid #eaebed;
        border-radius: 16px;
        width: 100%;
      }
      .wrapper {
        box-sizing: border-box;
        padding-top: 8px;
        padding-left: 24px;
        padding-right: 24px;
        padding-bottom: 24px;
      }
      .footer {
        clear: both;
        padding-top: 24px;
        text-align: center;
        width: 100%;
      }
      .footer td,
      .footer p,
      .footer span,
      .footer a {
        color: #9a9ea6;
        font-size: 16px;
        text-align: center;
      }
      p {
        font-family: fira-sans;
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        margin-bottom: 16px;
      }
      a {
        color: #0867ec;
        text-decoration: underline;
      }
      .btn {
      box-sizing: border-box;
      min-width: 100% !important;
      width: 100%;
    }
    
    .btn > tbody > tr > td {
      padding-bottom: 16px;
    }
    
    .btn table {
      width: auto;
    }
    
    .btn table td {
      background-color: #ffffff;
      border-radius: 4px;
      text-align: center;
    }
    
    .btn button {
      background-color: #ffffff;
      border: solid 2px #036252;
      border-radius: 4px;
      box-sizing: border-box;
      color: #036252;
      cursor: pointer;
      display: inline-block;
      font-size: 16px;
      font-family: fira-sans;
      font-weight: bold;
      margin: 0;
      padding: 12px 24px;
      text-decoration: none;
      text-transform: capitalize;
    }
    
    .btn-primary table td {
      background-color: #036252;
    }
    
    .btn-primary button {
      background-color: #036252;
      border-color: #036252;
      color: #ffffff;
    }
    
    @media all {
      .btn-primary table td:hover {
        background-color: #057261 !important;
      }
      .btn-primary a:hover {
        background-color: #057261 !important;
        border-color: #057261 !important;
      }
    }
      .header {
        background-color: #FFF8ED;
        padding: 16px;
        text-align: left;
      }
      .header img {
        max-width: 150px;
      }
      @media only screen and (max-width: 640px) {
        .main p,
        .main td,
        .main span {
          font-size: 16px !important;
        }
        .wrapper {
          padding: 8px !important;
        }
        .container {
          padding: 0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }
        .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
      <tr>
        <td>&nbsp;</td>
        <td class="container">
          <div class="content">
            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main">
              <!-- START HEADER -->
              <tr>
                <td class="header">
                <img src="https://bitcoinkeeper.app/icons/keeper-logo.png" alt="Keeper Logo">
                <hr>
                </td>
              </tr>
              <!-- END HEADER -->
              
              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper">
                  <body>
                    <p><b>Inheritance Key Signing Request</b></p>
                    <p>Dear user, your Vault's Inheritance Key's signature is being requested - {{requestId}}</p>
                    <p>Please press Decline to reject the request in order to avoid its auto approval in {{requestAutoApprovesIn}}.</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                      <tbody>
                        <tr>
                          <td align="center">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                              <tbody>
                                <tr><td><form action="{{server_url}}/v3/declineInheritanceKeyRequest" method="post">
                                  <input type="hidden" name="requestId" value={{requestId}}>
                                  <button type="submit">DECLINE</button>
                                </form></td></tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  <p>Need help? Reach out to us via the in-app Concierge.</p>
                  <p>
                    Thank you for choosing Keeper.<br>
                    Kind Regards,<br>
                    Team Keeper.<br>
                    <a href="https://x.com/bitcoinkeeper_"><img src="https://bitcoinkeeper.app/icons/x.png" alt="X Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.youtube.com/channel/UCMqDNxbz16w8pxpmsa6s8GQ"><img src="https://bitcoinkeeper.app/icons/youtube.png" alt="Youtube Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.linkedin.com/company/bithyve/"><img src="https://bitcoinkeeper.app/icons/linkedin.png" alt="Linkedin Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://medium.com/bitbees"><img src="https://bitcoinkeeper.app/icons/medium.png" alt="Medium Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://t.me/bitcoinkeeper"><img src="https://bitcoinkeeper.app/icons/telegram.png" alt="Telegram Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://github.com/bithyve/"><img src="https://bitcoinkeeper.app/icons/github.png" alt="Github Logo" style="width: 15px; vertical-align: middle;"></a>
                  </p>
                </td>
              </tr>
              <!-- END MAIN CONTENT AREA -->
            </table>

            <!-- START FOOTER -->
            <div class="footer">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="content-block">
                    <span class="apple-link">Bithyve, London, United Kingdom</span>
                  </td>
                </tr>
              </table>
            </div>
            <!-- END FOOTER -->
            
          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`,
  IKS_DECLINE: `
  <!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Request Declined</title>
    <style media="all" type="text/css">
      body {
        font-family: fira-sans;
        -webkit-font-smoothing: antialiased;
        font-size: 16px;
        line-height: 1.3;
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
        background-color: #f4f5f6;
        margin: 0;
        padding: 0;
      }
      table {
        border-collapse: separate;
        width: 100%;
      }
      table td {
        font-family: fira-sans;
        font-size: 16px;
        vertical-align: top;
      }
      .container {
        margin: 0 auto !important;
        max-width: 600px;
        padding: 24px 0;
        width: 100%;
      }
      .content {
        display: block;
        margin: 0 auto;
        max-width: 600px;
      }
      .main {
        background: #FFF8ED;
        border: 1px solid #eaebed;
        border-radius: 16px;
        width: 100%;
      }
      .wrapper {
        box-sizing: border-box;
        padding-top: 8px;
        padding-left: 24px;
        padding-right: 24px;
        padding-bottom: 24px;
      }
      .footer {
        clear: both;
        padding-top: 24px;
        text-align: center;
        width: 100%;
      }
      .footer td,
      .footer p,
      .footer span,
      .footer a {
        color: #9a9ea6;
        font-size: 16px;
        text-align: center;
      }
      p {
        font-family: fira-sans;
        font-size: 16px;
        font-weight: normal;
        margin: 0;
        margin-bottom: 16px;
      }
      a {
        color: #0867ec;
        text-decoration: underline;
      }
      .btn {
      box-sizing: border-box;
      min-width: 100% !important;
      width: 100%;
    }
    
    .btn > tbody > tr > td {
      padding-bottom: 16px;
    }
    
    .btn table {
      width: auto;
    }
    
    .btn table td {
      background-color: #ffffff;
      border-radius: 4px;
      text-align: center;
    }
    
    .btn button {
      background-color: #ffffff;
      border: solid 2px #036252;
      border-radius: 4px;
      box-sizing: border-box;
      color: #036252;
      cursor: pointer;
      display: inline-block;
      font-size: 16px;
      font-family: fira-sans;
      font-weight: bold;
      margin: 0;
      padding: 12px 24px;
      text-decoration: none;
      text-transform: capitalize;
    }
    
    .btn-primary table td {
      background-color: #036252;
    }
    
    .btn-primary button {
      background-color: #036252;
      border-color: #036252;
      color: #ffffff;
    }
    
    @media all {
      .btn-primary table td:hover {
        background-color: #057261 !important;
      }
      .btn-primary a:hover {
        background-color: #057261 !important;
        border-color: #057261 !important;
      }
    }
      .header {
        background-color: #FFF8ED;
        padding: 16px;
        text-align: left;
      }
      .header img {
        max-width: 150px;
      }
      @media only screen and (max-width: 640px) {
        .main p,
        .main td,
        .main span {
          font-size: 16px !important;
        }
        .wrapper {
          padding: 8px !important;
        }
        .container {
          padding: 0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }
        .main {
          border-left-width: 0 !important;
          border-radius: 0 !important;
          border-right-width: 0 !important;
        }
      }
      @media all {
        .ExternalClass {
          width: 100%;
        }
        .ExternalClass,
        .ExternalClass p,
        .ExternalClass span,
        .ExternalClass font,
        .ExternalClass td,
        .ExternalClass div {
          line-height: 100%;
        }
        .apple-link a {
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          line-height: inherit !important;
          text-decoration: none !important;
        }
        #MessageViewBody a {
          color: inherit;
          text-decoration: none;
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          line-height: inherit;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
      <tr>
        <td>&nbsp;</td>
        <td class="container">
          <div class="content">
            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main">
              <!-- START HEADER -->
              <tr>
                <td class="header">
                  <img src="https://bitcoinkeeper.app/wp-content/uploads/2023/02/keeper-logo.webp" alt="Keeper Logo">
                <hr>
                </td>
              </tr>
              <!-- END HEADER -->
              
              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper">
                  <body>
                    <p><b>{{status}}</b></p>                    
                    <br><br>Thank you for choosing Keeper.<br>
                    Kind Regards,<br>
                    Team Keeper.<br>
                    <a href="https://x.com/bitcoinkeeper_"><img src="https://bitcoinkeeper.app/icons/x.png" alt="X Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.youtube.com/channel/UCMqDNxbz16w8pxpmsa6s8GQ"><img src="https://bitcoinkeeper.app/icons/youtube.png" alt="Youtube Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://www.linkedin.com/company/bithyve/"><img src="https://bitcoinkeeper.app/icons/linkedin.png" alt="Linkedin Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://medium.com/bitbees"><img src="https://bitcoinkeeper.app/icons/medium.png" alt="Medium Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://t.me/bitcoinkeeper"><img src="https://bitcoinkeeper.app/icons/telegram.png" alt="Telegram Logo" style="width: 15px; vertical-align: middle;"></a>
                    <a href="https://github.com/bithyve/"><img src="https://bitcoinkeeper.app/icons/github.png" alt="Github Logo" style="width: 15px; vertical-align: middle;"></a>
                  </p>
                </td>
              </tr>
              <!-- END MAIN CONTENT AREA -->
            </table>

            <!-- START FOOTER -->
            <div class="footer">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="content-block">
                    <span class="apple-link">Bithyve, London, United Kingdom</span>
                  </td>
                </tr>
              </table>
            </div>
            <!-- END FOOTER -->
            
          </div>
        </td>
        <td>&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`,
};

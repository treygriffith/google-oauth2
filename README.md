###Google_Oauth2
is a library designed to make working with Google's Oauth2 API's more bearable.

As of now, it only supports one API, contacts, out of the box, but adding additional API's, either on the fly or permanently, is quite easy.

USAGE
------
```javascript
var oauth2 = new google_oauth2(MY_CLIENT_ID [, options]);

oauth2.authenticate(); //sends the user to the Google authorization endpoint

oauth2.authResponse(function(error, access_token) { //extract the access token
	if(access_token) {
		//execute some code here
	} else if(error) {
		//a response was attempted, but an error occurred
	} else {
		//there was nothing in the url fragment, in all likelihood, this was not a response to authentication
	}
});

oauth2.query(api [, options], function(error, results) {
	// execute some code on the returned values
});
```

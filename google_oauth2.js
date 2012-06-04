/*

Google_Oauth2 is a library designed to make working with Google's Oauth2 API's more bearable.

As of now, it only supports one API, contacts, out of the box, but adding additional API's, either on the fly or permanently, is quite easy.

USAGE: 
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


*/

if( typeof Array.isArray !== 'function' ) {
    Array.isArray = function( arr ) {
        return Object.prototype.toString.call( arr ) === '[object Array]';
    };
}

var google_oauth2 = function(client_id, options) {

	// Define Utility Functions
	var merge = function(obj1, obj2) {
		if(!obj1) {
			obj1 = {};
		}
		if(obj2) {
		    for(var key in obj2) {
		      if(!obj1[key]) {
		        obj1[key] = obj2[key];
		      } else {
		      	if(obj2[key] && typeof(obj2[key]) == typeof(obj1[key]) == "object") {
		      		obj1[key] = merge(obj1[key], obj2[key]);
		      	}
		      }
		    }
		}
	    return obj1;
	};

	// Check for a Google client_id
	if(!client_id) {
		throw new Error("client_id is required");
		return false;
	}

	// Set up overall Google Oauth Default options
	var default_options = {
		auth_endpoint: "https://accounts.google.com/o/oauth2/auth",
		//scope:,
		//state:,
		approval_prompt: "auto",
		redirect_uri: window.location.href,
		token_info_endpoint: "https://www.googleapis.com/oauth2/v1/tokeninfo",
		error: alert
	};

	//scope required for each API
	var scope = {
		contactsv3: "https://www.google.com/m8/feeds"
	};

	if(options && options.api) {
		if(typeof options.api == "string") {
			options.api = [options.api];
		}
		default_options.scope = [];
		for(var i=0;i<options.api.length;i++) {
			default_options.scope.push(scope[options.api[i]]);
		}
		default_options.scope = default_options.scope.join(" ");
	}

	//format the scope as a space-delimited string
	if(Array.isArray(options.scope)) {
		options.scope = options.scope.join(" ");
	};

	//merge the scopes as they can't be merged effectively by the merge function
	options.scope = $.trim([options.scope, default_options.scope].join(" "));

	options = this.options = merge(options, default_options);



	//this is a client-side javascript application, so we should use 'token' as the response_type
	options.response_type = "token";

	options.client_id = client_id;

	// Send the user to the authentication page
	this.authenticate = function(auth_options) {
		window.location = this._buildAuthQuery(merge(auth_options, options));
	}

	// internal function to build the authentication query
	this._buildAuthQuery = function(_options) {
		var query = _options.auth_endpoint;
		var params = ["response_type", "client_id", "redirect_uri", "scope", "state", "approval_prompt"];
		var i = 0;
		for(var param in options) {
			if(params.indexOf(param) != -1) {
				if(0 == i++) {
					query += "?";
				} else {
					query += "&";
				}
				query += param+"="+encodeURIComponent(_options[param]);
			}
		}
		return query;
	}

	// Parse an incoming response from Google
	this.authResponse = function(callback) {
		//extract the access_token from the url fragment
		var params = {}, fragment = location.hash.substring(1), regex = /([^&=]+)=([^&]*)/g, m;
		while (m = regex.exec(fragment)) {
		  params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
		}

		if(params.access_token) {
			this.access_token = params.access_token;
			this.expires_in = params.expires_in;
			this.expire_start = (new Date()).getTime()/1000;
		} else if(params.error) {
			this.error("Error authenticating: "+params.error);
			callback("Error authenticating");
			return;
		} else {
			//no authentication was attempted, or it was unable to be parsed from the fragment
			callback(false);
			return;
		}

		var self = this;

		// Send a token_info request to google to validate this access_token (and mitigate confused deputy issues).
		// Update the expiry time on a successful validation
		$.get(options.token_info_endpoint, {access_token: this.access_token}, function(data) {
			if(data && data.audience === client_id && $.trim(data.scope) === $.trim(options.scope)) {
				//authorization was successful
				self.expires_in = data.expires_in;
				self.expire_start = (new Date()).getTime()/1000;
				callback(null, self.access_token);

			} else if (data && data.error) {
				self.error("Error verifying token");
				callback("Error verifying token");

			} else {
				console.log(data);
				self.error("Error parsing server response");
				callback("Error verifying token");
			}
		}, "json");
	}

	// the error function. "alert()" by default
	this.error = function(error) {
		if(options.error && typeof options.error == "function") {
			try {
				options.error(error);
			} catch(e) {
				alert(error);
			}
		}
		if(options.debug) {
			console.log(error);
		}	
	}

	// Query a Google API
	this.query = function(api, api_options, callback) {
		switch(arguments.length) {
			case 1:
				if(typeof api != "function") {
					throw new Error("Callback is required");
					return;
				} else if(options.api && options.api.length == 1) {
					callback = api;
					api = options.api[0];
					api_options = null;
				} else {
					this.error("No API specified");
					callback("No API specified");
					return;
				}
			break;

			case 2:
				callback = api_options;
				api_options = null;
			break;
		}

		if(!this.access_token && (!api_options || !api_options.access_token)) {
			this.authenticate();
			return;
		}

		api_options = merge(api_options, this.api_default_options[api]);
		api_options = merge(api_options, {access_token: this.access_token});

		if(this.expire_start + this.expires_in > (new Date()).getTime()/1000) {

			var self = this;

			api_options.params.access_token = api_options.access_token;

			//send the request to the endpoint
			$.ajax({
				type: api_options.method,
				url: api_options.endpoint,
				data: api_options.params,
				success: function(data) {
					//call the api's data retrieval function
					callback(null, self.api_data[api_options.name](data));
				},
				dataType: api_options.dataType
			});

		} else {
			this.authenticate();
			return;
		}

	}


	//default options for the api
	this.api_default_options = {
		contactsv3: {
			name: "contactsv3",
			endpoint: "https://www.google.com/m8/feeds/contacts/default/full",
			params: {
				"max-results": 10000000,
				v: "3.0",
				alt: "json"
			},
			method: "get",
			dataType: "json"
		}
	};

	//different api data formats
	this.api_data = {
		contactsv3: function(data) {
			var contacts = []
			for(var i=0;i<data.feed.entry.length;i++) {
				var contact = data.feed.entry[i];
				if(contact.gd$email) {
					for(var j=0;j<contact.gd$email.length;j++) {
						if(contact.gd$email[j].primary) {
							contacts.push({
								email:contact.gd$email[j].address,
								name:contact.title.$t
							});
						}
					}
				}
			}
			return contacts.sort(function(a, b) {
				var Aname = a.name ? a.name.toLowerCase() : a.email.toLowerCase();
				var Bname = b.name ? b.name.toLowerCase() : b.email.toLowerCase();
				if(Aname < Bname) {
					return -1;
				} else if(Bname < Aname) {
					return 1
				} else {
					return 0;
				}
			});
		}
	};

	return this;
}


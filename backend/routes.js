const express = require('express');
const { Beer, Checkin, User, Venue } = require('./models');
const axios = require('axios');
const path = require('path')

const router = express.Router();

const REDIRECT_URL = 'https://www.thebeerfeed.com/AuthRedirect';

var feedCache = {};

function getData(feed, lastID){
	var cache = feedCache[feed];
	return Checkin.aggregate([
		{ 
			$match : {
				$and : [
					{ checkin_username : feed },
					{ checkin_id : { $gt : lastID } },
					{ venue_category : { $ne : 'Travel & Transport'} },
					{ venue_category : { $ne : 'Outdoors & Recreation' } },
					{ venue_url : { $ne : null } }
				]
			}
		},
		{
			$group : {
				_id : { venue_id : "$venue_id", bid : "$bid" },
				checkin_id : { $max : '$checkin_id'},
				name : { $first : '$beer_name' },
				bid : { $first : '$bid' },
				lat : { $first : '$lat' },
				lon : { $first : '$lon' },
				venue : { $first : '$venue' },
				brewery : { $first : '$brewery_name' },
				venue_id : { $first : '$venue_id' },
				created : { $max : '$checkin_created' },
				checkin_count : { $sum : 1 }
			}
		},
		{
			$lookup : {
				from : 'beers',
				localField : 'bid',
				foreignField : 'bid',
				as : 'beer'
			}
		},
		{ $unwind : '$beer' },
		{
			$project : {
				"beer._id" : 0,
				"beer.brewery_id" : 0,
				"beer.last_updated" : 0,
				"beer.twitter" : 0,
				"beer.brewery_url" : 0,
				"beer.bid" : 0,
				"beer.brewery" : 0,
				"beer.facebook" : 0,
				"beer.brewery_slug" : 0,
			}
		},
		{ $match : { "beer.rating" : { $gte : 4.0 } } },
		{ $sort : { checkin_id : -1 } }
	])
	.then(result => {
		const twoDays = new Date(new Date() - 1000 * 60 * 60 * 24 * 2);
		cache = (cache || []).filter(c => (new Date(c.created)) > twoDays);

		const allCheckins = result.concat(cache || []);
		feedCache[feed] = allCheckins;
		return allCheckins;
	})
}

const usersPromise = User.find({general_purpose : false})

function refresh(){
	console.log('Refreshing cache')
	usersPromise.then(users => {
		users.forEach(user => {
			const cache = feedCache[user.id];
			const min_id = (cache && cache.length > 0) ? cache[0].checkin_id : 0;	
			getData(user.id, min_id)
		})
	})
}

setInterval(refresh, 1000 * 60 * 20)

module.exports = function(untappd){
	/**
	 * Get the feed for a particular location
	 * @param { string } user - The feed to fetch for
	 * @param { number } [last_id] - offset to start fetching from (optional)
	 * @return { Array<Object> } - The feed
	 */
	router.get('/Feed/:user/:last_id?', (req, res) => {
		var cache = feedCache[req.params.user];
		const min_id = (cache && cache.length > 0) ? cache[0].checkin_id : 0;
		
		getData(req.params.user, min_id)
			.then(allCheckins => {
				if(allCheckins.length == 0){
					res.json({
						lastID : req.params.last_id || 0,
						checkins : []
					})
				}else{
					if(req.params.last_id){
						const last_id = +req.params.last_id;
						res.json({
							lastID : allCheckins[0].checkin_id,
							checkins : allCheckins.filter(c => c.checkin_id > last_id)
						});
					}else{
						res.send({
							lastID : allCheckins[0].checkin_id,
							checkins : allCheckins
						})
					}
				}
			})
			.catch(err => {
				console.log(err);
				res.status(500).send(err)
			})
	});

	/**
	 * Fetch all available feeds from the server
	 * @return {Array<Object>} - Returns all available feeds
	 */
	router.get('/Feeds', function(req, res){
		User.find({general_purpose : false})
			.then(result => res.json(result))
			.catch(err => err.status(500).send(err))
	})

	/**
	 * Authenticate a user
	 * This will redirect the user to Untappd and have them login.
	 * After signing in to their account, they will be send to the
	 * `AuthRedirect` route which will contain the user's access_token
	 */
	router.get('/Auth', function(req, res){
	  const base = 'https://untappd.com/oauth/authenticate'
	  const params = {
			client_id : process.env.UNTAPPD_CLIENT_ID,
			client_secret : process.env.UNTAPPD_CLIENT_SECRET,
			response_type : 'code',
			redirect_url : REDIRECT_URL
		}
	  const url = `${base}?${Object.keys(params).map(k => `${k}=${params[k]}`).join('&')}`;
	  res.redirect(url);
	});

	/**
	 * Second phase of user authentication
	 * Add the user to the database.
	 */
	router.get('/AuthRedirect', function(req, res){
		axios.request({
			url : 'https://untappd.com/oauth/authorize',
			params : {
				client_id : process.env.UNTAPPD_CLIENT_ID,
				client_secret : process.env.UNTAPPD_CLIENT_SECRET,
				response_type : 'code',
				redirect_url : REDIRECT_URL,
				code : req.query.code
			}
		}).then(({data}) => {
			const access_token = data.response.access_token;
			untappd.setAccessToken(access_token);
			untappd.userInfo()
				.then(data => {
					const query = { id : data.response.user.user_name };
					const userData = {
						id : data.response.user.user_name,
						access_token,
						general_purpose : true
					};
					User.findOneAndUpdate(query, userData, { upsert : true })
						.then(() => res.send())
						.catch(err => res.status(500).send(err))
				})
				.catch(err => res.status(500).send(err))
		}).catch(err => res.status(500).send(err))
	});

	router.get('*', function(req, res){
		// Serve the client if no route
		res.sendFile(path.join(__dirname, '../build/index.html'))
	})

	return router;	
}

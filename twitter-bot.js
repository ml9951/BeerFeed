require('dotenv').config({silent : true})
var Twit = require('twit')
var pg = require('pg')
var _ = require('lodash')

var db = new pg.Client(process.env.OPENSHIFT_POSTGRESQL_DB_URL);
db.connect();

var T = new Twit({
	consumer_key : process.env.TWITTER_KEY,
	consumer_secret : process.env.TWITTER_SECRET,
	access_token : process.env.TWITTER_ACCESS_TOKEN,
	access_token_secret : process.env.TWITTER_ACCESS_SECRET
})

function tweet(beer){
	db.query(`SELECT * FROM beers WHERE bid=${beer.bid} AND venue_id=${beer.venue_id}`, (err, result) => {
		if(err){
			console.log(err)
		}else{
			var info = result.rows[0]
			var status = `${beer.count} people found ${info.brewery}'s ${info.name} at ${info.venue}`
			T.post('statuses/update', { 
				status: status, 
				lat : info.lat,
				long : info.lon
			}, function(err, data, response) {
			  console.log(data)
			});			
		}
	})
}

function dropOldEntries(){
  db.query('DELETE FROM top_beers WHERE date < NOW() - INTERVAL \'2 days\';')
}

function check(){
	db.query(`SELECT * FROM(
				SELECT bid, venue_id, count(*), avg(rating) as rating, max(created) as date, username
				FROM beers
				GROUP BY bid, venue_id, username
				HAVING count(*) > 5
			)q WHERE rating > 4.4 AND username='nyc_feed'`, (err, result) => {
		if(err){
			console.log(err);
		}else{
			_.forEach(result.rows, row =>{
				db.query(`
					SELECT * FROM top_beers WHERE bid=${row.bid} AND
						venue_id=${row.venue_id};
				`, (err, result2) => {
					if(err){
						console.log(err)
					}else if(result2.rows.length == 0){
						console.log(`INSERT INTO top_beers(bid, venue_id, count, rating, date) VALUES (${row.bid}, ${row.venue_id}, ${row.count}, ${row.rating}, '${row.date}');`)
						db.query(`
							INSERT INTO top_beers(bid, venue_id, count, rating, date) VALUES 
								(${row.bid}, ${row.venue_id}, ${row.count}, ${row.rating}, '${row.date.toLocaleDateString()}');
						`, err => {
							if(err){
								console.log(err)
							}else{
								console.log('inserted!')
								tweet(row)
							}
						})
					}else{// already tweeted this one
						console.log('already inserted')
					}
				})
			})
			setTimeout(check, 1000 * 60 * 1) //30 minutes
			dropOldEntries()
		}
	})
}

module.exports.check = check
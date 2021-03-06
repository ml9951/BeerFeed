require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const routes = require('./backend/routes');
const UntappdClient = require('untappd-js');
const { Checkin, Beer } = require('./backend/models');
const { startAll } = require('./backend/feed-proc');
const twitterBot = require('./backend/twitter-bot');

mongoose.Promise = require('bluebird');

var untappd = new UntappdClient();

const CLIENT_SECRET = process.env.UNTAPPD_CLIENT_SECRET;
const CLIENT_ID = process.env.UNTAPPD_CLIENT_ID;

untappd.setClientId(CLIENT_ID);
untappd.setClientSecret(CLIENT_SECRET);

const PORT = process.env.PORT || '3001';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost/beerfeed';

mongoose.connect(MONGO_URL)

const app = express();

app.use(express.static(path.join(__dirname, 'build')));

app.use('/', routes(untappd));

const server = app.listen(PORT, function () {
  const { address, port } = server.address();
  console.log(`Beer feed listening at http://${address}:${port}`);
});

function removeOld(){
	const twoDays = new Date(new Date() - 1000 * 60 * 60 * 24 * 2);
	Checkin.find({ checkin_created : { $lt : twoDays } })
		.remove((err, result) => {
			if(err){
				console.log(err)
			}
		})
	Beer.find({last_updated : { $lt : twoDays } })
		.remove((err) => {
			if(err){
				console.log(err)
			}
		})
}
removeOld()
setInterval(removeOld, 1000*60*10) // Filter old checkins every 10 minutes

if(process.env.NODE_ENV === 'production'){
	startAll();
	twitterBot.startAll();
}

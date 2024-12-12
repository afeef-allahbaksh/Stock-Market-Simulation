# cs375GOMAS
This is the github repo for the cs375 project

To get the project up and running
go into the route directroy and run 
npm install
To create your database and table, run the command psql --username USERNAME -f setup.sql, replacing your use name with your postgres user.


YOU MAY HAVE TO RUN:
npm install function-bind
It has been popping up a quarter of the time during testing.

ALSO create an env.json file in the root directory that has

	"user": "postgres",
	"host": "localhost",
	"db_name": "auth", 
	"password": "Luxray924!",
	"API_KEY": "STOCK API KEY",
	"NEWS_API_KEY": "NEWS API KEY",
	"port": 5432,
	"JWT_SECRET": "CANBEANYTHINGLESSTHAN50CHARS"

you should than be able to go the the /app directory
and run node.js
OR 
in the root directory run npm start
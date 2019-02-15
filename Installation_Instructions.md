# Installation Instructions
These are basic instructions for getting CalendarNotes up and running on your system.  At some future point it is hoped that an actual installation package can be developed.  These instructions should work regardless of the target operating system.  This is the beauty of Node and Electron.

## Prerequisites
This project depends on a connection to a MySQL Database.  The database server can be installed locally or remotely and a valid username and password will also be required.  This user must have the appropriate permissions to be able to create tables if the Create Tables button is to be used to initiate the database.  The steps required to create a MySQL database are not included here, but there are plenty of sites that provide instructions on how to get a MySQL database up and running.  Digital Ocean provides an excellent set of instructions for setting up MySQL https://www.digitalocean.com/community/tutorials/how-to-install-mysql-on-ubuntu-18-04.

## Install Node.js
Go to the official Nodejs website https://nodejs.org/en/download/ and follow the instructions to download and install the latest version of node and npm on your specific OS.  (Note: npm is installed as part of the node installation.)

## Download the CalendarNotes Project
Click on the Clone or Download button and download the zip file for the project.

## Unzip Into a Directory
Create / select a directory on the target system and unzip the project file into this directory.

## Install Node Modules
Open a terminal (or command prompt) and use cd to change directories until the terminal is in the root directory for the project.  Then run the **npm install** command to install all of the node modules.  A progress bar should be displayed for each module that is downloaded and installed.  This will result in the creation of a node_modules directory under the project.

## Run the Application
From a terminal (or command prompt) navigate to the root project directory.  Then run **npm start** to run the CalendarNotes application.  (Note: The terminal session from the *Install Node Modules* step can be used to run the application.  Also, this terminal session will continue to run while the application is running.)

## Connect to Database
When the application is started for the first time it will display a message alerting the user that a settings file could not be found.  Acknowledge this warning and then click on the gear in the upper right corner to reveal the settings.  Enter the required information for the MySQL database connection.  Use the Test Connection button to verify that the settings have been entered properly.  **Be aware, the current version of CalendarNotes maintains the settings in a hidden file named *.settings*.  This file is in plain text, so your password will be easily accessible to anyone who has access to the installation folder.**

## Create Tables
If this database does not contain the CalendarNotes tables use the Create Tables button to create them.  This will create two tables, Notes and TasksList.

## Write Your First Note
When the application is first opened it will display today's notes.  A blank space is always inserted if no note was found.  This can be deleted before entering the notes for the day.  Click in the notes area and type some text.  The Save button will be surrounded by *'s if an edit has been made that has not been committed to the database.  A note can be saved to the database by clicking on the Save button or by clicking on a different date in the Calendar.  Be careful when closing the application that the notes have been saved.  **Note: CalendarNotes does not save the current note when the application is closed and no warning is given if edits have not been saved.**
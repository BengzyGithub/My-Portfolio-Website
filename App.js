const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql');
const path = require('path'); // Import the 'path' module
const ejs = require('ejs');
const { isDate } = require('util/types');
//initialize express app
const app = express();
// Serve static files from the 'public' directory
app.use(express.static('public'));
//set up and use body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up sessions
app.use(session({
  secret: 'your-secret-key',
  resave: true,
  saveUninitialized: true
}));

// Set up passport
app.use(passport.initialize());
app.use(passport.session());

// creating a file stream to read data to/from
const fs = require('fs');

// Read database configuration from the file (dbconfig.json)
const dbConfigPath = path.join(__dirname, 'dbconfig.json');
const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));

// Set up MySQL connection using the configuration from the file
const connection = mysql.createConnection(dbConfig);


connection.connect();

// Passport local strategy for username/password login
passport.use(new LocalStrategy(
  (username, password, done) => {
    // logic to check username and password in the database
    connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
      if (err) throw err;

      if (results.length > 0) {
        return done(null, results[0]);
      } else {
        return done(null, false, { message: 'Incorrect username or password.' });
      }
    });
  }
));

// Passport Google strategy for Google login
passport.use(new GoogleStrategy({
  clientID: 'your-client-id',
  clientSecret: 'your-client-secret',
  callbackURL: 'your-callback-url'
},
(_accessToken, _refreshToken, profile, done) => {
  // Implement your own logic to save or retrieve user information from the database
  // Example:
  const user = {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.emails[0].value
  };
  return done(null, user);
}));

/**
 * serializeUser and DeserializeUser functions
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  // logic to retrieve user from the database
  connection.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) {
      return done(err, null);
    }

    if (results.length > 0) {
      const user = results[0];
      return done(null, user);
    } else {
      return done(null, false);
    }
  });
});


// Set up for views directory and view engine
app.set('lib', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// Route for the login page
app.get('/login', (_req, res) => {
  const data = {
    username: 'exampleUser',
    message: 'Welcome to the login page!'
  };

  res.render('login', { data: data });
});

// Example route for Google login
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (_req, res) => {
    res.redirect('/profile');
  }
);
  
  //Route for the login page
  app.post('/login',
    passport.authenticate('local', {
      successRedirect: '/profile',
      failureRedirect: '/login',
      failureFlash: true
    })
  );

//Route for logging out
app.get('/logout', (req, res) => {
  // Destroy the user session
  req.logout((err) => {
    if (err) {
      console.error(err);
    }
    // Redirect to the login page
    res.redirect('/login');
  });
});


// Example route for the user profile page
app.get('/profile', (req, res) => {
  // Check if req.user is defined before accessing req.user.id
  if (req.user && req.user.id) {
    // Retrieve user information from the users table
    const userId = req.user.id;
    connection.query('SELECT * FROM users WHERE id = ?', [userId], (err, userResults) => {
      if (err) throw err;

      if (userResults.length > 0) {
        const user = userResults[0];

        // Retrieve user information from the user_profile table
        connection.query('SELECT * FROM user_profile WHERE userId = ?', [userId], (err, profileResults) => {
          if (err) throw err;

          const profile = profileResults.length > 0 ? profileResults[0] : null;

        // Retrieve user information from the about_me table
        connection.query('SELECT * FROM about_me WHERE user_id = ?', [userId], (err, aboutMeResults) => {
        if (err) throw err;

          const aboutMe = aboutMeResults.length > 0 ? aboutMeResults[0] : null;

        // Retrieve user information from the projects table
        connection.query('SELECT * FROM projects WHERE user_id = ?', [userId], (err, projectsResults) => {
          if (err) throw err;

          const projects = projectsResults;

        // Retrieve user information from the skills table
        connection.query('SELECT * FROM skills WHERE user_id = ?', [userId], (err, skillsResults) => {
            if (err) throw err;

            const skills = skillsResults;

          // Retrieve user information from the work_experience table
        connection.query('SELECT * FROM work_experience WHERE user_id = ?', [userId], (err, workExpResults) => {
              if (err) throw err;

            const workExperience = workExpResults;

          // Retrieve user information from the education table
        connection.query('SELECT * FROM education WHERE user_id = ?', [userId], (err, educationResults) => {
                if (err) throw err;

            const education = educationResults;
            //check the data being passed to the template
          console.log('profile info:', profile);
          console.log('About Me:', aboutMe);
          console.log('Projects:', projects);
          console.log('Skills:', skills);
          console.log('Work Experience:', workExperience);
          console.log('Education:', education);
          // Render the profile page with the retrieved data
          res.render('profile.ejs', {
            user: user,
            profile: profile,
            aboutMe: aboutMe,
            projects: projects,
            skills: skills,
            workExperience: workExperience,
            education: education
          });//end of rendering the profile page with data
        });//end of retrieving info from education
      });//end of retrieving info from work experience
    });//end of retrieving info from skills
  });//end of retrieving info from projects
});//end of retrieving info from about me
});//end of retrieving info from user_profile
      } else {
        // Handle user not found
        res.redirect('/login');
      }
    });
  } else {
    // Handle the case when req.user is not defined
    res.redirect('/login');
  }
});

/**
 * route for the account creation page
 */
app.post('/signup', (req, res) => {
  // logic to create a new account in the database
  const { username, password, email } = req.body;
  const newUser = { username, password, email };

  connection.query('INSERT INTO users SET ?', newUser, (err, result) => {
    if (err) throw err;

    const userId = result.insertId;
    //const user_id = result.insertId;

    // Create an empty profile for the new user
    const emptyprofile = { userId };
    connection.query('INSERT INTO user_profile SET ?', emptyprofile, (err) => {
      if (err) throw err;

      // Insert into other relevant tables (e.g., about_me, skills, work_experience, education)
      const emptyAboutMe = { 
        user_id: userId, 
        full_name: '', 
        bio: '' };
      const emptySkills = { 
        user_id: userId, 
        skill_name: '' };
      const emptyWorkExperience = { 
        user_id: userId, 
        employer: '', 
        position: '', 
        from_duration: null, 
        to_duration: null, 
        description: '', 
        reference: '', 
        others_achievements: '' };
      const emptyEducation = { 
        user_id: userId, 
        school: '', 
        major: '', 
        degree: false, 
        from_duration: null, 
        to_duration: null, 
        gpa: '', 
        awards: '', 
        others_files: '' };

      connection.query('INSERT INTO about_me SET ?', emptyAboutMe, (err) => {
        if (err) throw err;
      });

      connection.query('INSERT INTO skills SET ?', emptySkills, (err) => {
        if (err) throw err;
      });

      connection.query('INSERT INTO work_experience SET ?', emptyWorkExperience, (err) => {
        if (err) throw err;
      });

      connection.query('INSERT INTO education SET ?', emptyEducation, (err) => {
        if (err) throw err;
      });

      res.redirect('/login'); // Redirect to login page after account creation
    });
  });
});

/**
 * Save the users *about me* information
 */
app.post('/saveAboutMe', (req, res) => {
  const { full_name, bio } = req.body;

  // Update or insert the 'about me' information in the 'about_me' table
  connection.query(
    'INSERT INTO about_me (user_id, full_name, bio) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE full_name = ?, bio = ?',
    [req.user.id, full_name, bio, full_name, bio],
    (err, result) => {
      if (err) {
        console.error('Error saving About Me:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      // Check the result object to see if the query affected any rows
      if (result.affectedRows > 0 || result.changedRows > 0) {
        // Send a JSON response indicating success
        res.json({ success: true, message: 'About Me saved successfully!' });
      } else {
        console.warn('No rows affected or changed. Check your query and data.');
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
    }
  );
});//end of about me saving 

/**
 * Example route for the Projects Saving 
 */
const multer = require('multer');

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads'); // Specify the directory where you want to store uploaded files
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname); // Get the file extension
    const uniqueFilename = file.fieldname + '-' + uniqueSuffix + fileExtension;
    cb(null, uniqueFilename); // adjusting based on unique file name, this can be changed
  },
});


const upload = multer({ storage: storage });

// Use the upload middleware in your route
app.post('/saveProjects', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'code_samples[]', maxCount: 10 }, // Adjust maxCount as needed
  { name: 'images[]', maxCount: 10 },       // Adjust maxCount as needed
  { name: 'demo[]', maxCount: 10 },          // Adjust maxCount as needed
]), (req, res) => {
  console.log(req.body);
  console.log(req.files);
  const {
    project_description,
    project_url,
    projectName,
    projectType, 
    badges, 
    testing, 
    license, 
    contributors, 
  } = req.body;

/*Check if a file was uploaded &
Extract file paths from req.files */
const thumbnailPath = req.files.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;
const codeSamplesPaths = req.files['code_samples[]'] ? req.files['code_samples[]'].map(file => `/uploads/${file.filename}`) : null;
const imagesPaths = req.files['images[]'] ? req.files['images[]'].map(file => `/uploads/${file.filename}`) : null;
const demoPaths = req.files['demo[]'] ? req.files['demo[]'].map(file => `/uploads/${file.filename}`) : null;

// Update or insert the 'projects' information in the 'projects' table
connection.query(
  'INSERT INTO projects (user_id, project_description, project_url, code_samples, projectName, projectType, thumbnail, demo, badges, testing, license, contributors, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE project_description = ?, project_url = ?, code_samples = ?, projectName = ?, projectType = ?, thumbnail = ?, demo = ?, badges = ?, testing = ?, license = ?, contributors = ?, images = ?',
  [
    req.user.id,
    project_description,
    project_url,
    codeSamplesPaths ? codeSamplesPaths.join(',') : null, //code_samples is an array of files
    projectName,
    projectType,
    thumbnailPath, // ensuring thumbnail is a single file
    demoPaths ? demoPaths.join(',') : null, // demo is an array of files(mutiple)
    badges,
    testing,
    license,
    contributors,
    imagesPaths ? imagesPaths.join(',') : null, // Assuming images is an array of files
    project_description,
    project_url,
    codeSamplesPaths ? codeSamplesPaths.join(',') : null,
    projectName,
    projectType,
    thumbnailPath, // thumbnail is a single file
    demoPaths ? demoPaths.join(',') : null,  //demo can be mutilple files
    badges,
    testing,
    license,
    contributors,
    imagesPaths ? imagesPaths.join(',') : null,
  ],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      // Retrieve the last saved projects data
      connection.query('SELECT * FROM projects WHERE user_id = ?', [req.user.id], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ success: false, message: 'Internal Server Error' });
          return;
        }

        const lastSavedProjects = results;

        res.json({ success: true, message: 'Projects saved successfully!', lastSavedProjects });
      });
    }
  );
});


/**
 * Route for the Skills panel/table
 */
app.post('/saveSkills', (req, res) => {
  const { skill_name } = req.body;

  // Update or insert the 'skills' information in the 'skills' table
  connection.query(
    'INSERT INTO skills (user_id, skill_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_name = ?',
    [req.user.id, skill_name, skill_name],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      res.json({ success: true, message: 'Skills saved successfully!' });
    }
  );
});

/**
 * Route for the Work Experience edit panel
 */
app.post('/saveWorkExp', (req, res) => {
  const { employer, position, from_duration, to_duration, description, reference, others_achievements } = req.body;

  // Format date strings to 'YYYY-MM-DD' format
  //const formattedFromDuration = new Date(from_duration).toISOString().split('T')[0];
  //const formattedToDuration = new Date(to_duration).toISOString().split('T')[0];

  // Update or insert the 'work experience' information in the 'work_experience' table
  connection.query(
    'INSERT INTO work_experience (user_id, employer, position, from_duration, to_duration, description, reference, others_achievements) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE employer = ?, position = ?, from_duration = ?, to_duration = ?, description = ?, reference = ?, others_achievements = ?',
    [
      req.user.id,
      employer,
      position,
      from_duration,
      to_duration,
      description,
      reference,
      others_achievements,
      employer,
      position,
      from_duration,
      to_duration,
      description,
      reference,
      others_achievements,
    ],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      res.json({ success: true, message: 'Work Experience saved successfully!' });
    }
  );
});

/**
 * Route for the Education edit Panel savings
 */
app.post('/saveEducation', (req, res) => {
  const { school, major, degree, from_duration, to_duration, gpa, awards, othersfiles } = req.body;


  // Convert the 'degree' value to a boolean
  const isDegree = degree === 'true';

  // Update or insert the 'education' information in the 'education' table
  connection.query(
    'INSERT INTO education (user_id, school, major, degree, from_duration, to_duration, gpa, awards, others_files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE school = ?, major = ?, degree = ?, from_duration = ?, to_duration = ?, gpa = ?, awards = ?, others_files = ?',
    [
      req.user.id,
      school,
      major,
      isDegree,
      from_duration,
      to_duration,
      gpa,
      awards,
      othersfiles,
      school,
      major,
      isDegree,
      from_duration,
      to_duration,
      gpa,
      awards,
      othersfiles,
    ],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      res.json({ success: true, message: 'Education saved successfully!' });
    }
  );
});//end of Saving education

/**
 * get function rout to direct the user to Projects page
 */
// Modify the /fetchProjects endpoint
app.get('/projects', (req, res) => {
  // Check if a project ID is provided in the query parameters
  const projectId = req.query.id;

  if (projectId) {
    // Retrieve details for the selected project
    connection.query('SELECT * FROM projects WHERE id = ?', [projectId], (err, projectResults) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      const project = projectResults[0];
      res.render('projects', { project }); // Render the projects.ejs page with project details
    });
  } else {
    // Retrieve all user projects
    connection.query('SELECT * FROM projects WHERE user_id = ?', [req.user.id], (err, projectsResults) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
        return;
      }

      const projects = projectsResults;
      res.json({ success: true, projects });
    });
  }
});

// Update the server route for Portfolio page
/*app.get('/portfolio', (req, res) => {
  // Retrieve user's information for the Portfolio page
  // You need to fetch the required data (aboutMe, projects, skills, workExperience, education)
  // You can use similar queries as in the /profile route and pass the data to the 'portfolio' template
  // For simplicity, let's assume you already have this data
  const aboutMe = /* fetched aboutMe data ;
  const projects = /* fetched projects data;
  const skills = /* fetched skills data;
  const workExperience = /* fetched workExperience data; 
  const education = /* fetched education data; 

  res.render('portfolio', { aboutMe, projects, skills, workExperience, education });
});*/


// Start the server
const PORT = process.env.PORT || 3307;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

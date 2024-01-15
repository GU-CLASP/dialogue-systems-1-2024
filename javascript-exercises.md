# Part 1. JavaScript exercises to get started

These exercises can be done in your browser. If you feel courageous
enough, you can start with Part 2 and get tooling to work and then
return to Part 1.


Some basic exercises to get started with JavaScript. You don't need to
do them in any particular order or do all of them. Try reading all of
them before starting.  You can also take a look at some entries under
'JavaScript Fundamentals' to get the general idea here:
https://javascript.info/ , but definitely check or skim-read these
first:

https://javascript.info/variables
https://javascript.info/operators
https://javascript.info/logical-operators
https://javascript.info/function-basics

Also, feel free to message me on Discord.

## Exercise 1

Enter: https://playcode.io/javascript
Try to understand what is going on.

Some questions to help you understand the files:
- How does the html file connect to the script file? 
- What method is used in the script file to retrieve the HTML element? 

## HTML exercise - skip if you don't want to practice HTML for now

Create an interface in html where you have an input box, create a button too to submit the input in the box.

Tips: check the "onclick" and "alert" attributes for html or check this entry if you want to do it together with JavaScript: https://javascript.info/introduction-browser-events.

## Exercise 2: randomize and input/prompt

Write a program that takes a random integer between 1 and 10 from the user, and the user is then prompted to input a guess number. The program displays a message "Good Work" if the input matches the guess number otherwise "Not matched".

Tip: use your html code or check the prompt() function in JavaScript: https://javascript.info/alert-prompt-confirm

If you don't want to use prompt() or html input, you can use just variables, but it's recommended you that you learn about those.

Check: 
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random

Solution in the source:
https://www.w3resource.com/javascript-exercises/javascript-basic-exercise-8.php

## Exercise 3: operations, input/prompt, functions

Write a program that multiplies or divides two numbers. You can try creating a button for each operation and an input box for each of the two numbers. 

One solution (from source):
https://www.w3resource.com/javascript-exercises/javascript-basic-exercise-10.php
Maybe also check: https://javascript.info/function-basics#returning-a-value

## Exercise 4: operations and functions

Write a program to check a pair of numbers and return true if one of the numbers is 50 or if their sum is 50.

One solution:
https://www.w3resource.com/javascript-exercises/javascript-basic-exercise-18.php

## Exercise 5: finding string
In an array of names `let names = ["Anna", "Johannes", "Paula", "Daisy"]` , how would you find the index for the name "Paula"? How would you check if the name "Paula" is in the list? And how would you check if the name exists in the list if you could only search it as: "PAULA" or "paula"?

Check this: https://javascript.info/string

## Exercise 6: strings and length

Write a JavaScript program to create a string from a given string. This is done by taking the last 3 characters and adding them at both the front and back. The string length must be 3 or more.
For example: umbrella -> lla + umbrella + lla -> llaumbrellalla , cap -> cap + cap + cap -> capcapcap

One solution:
https://www.w3resource.com/javascript-exercises/javascript-basic-exercise-26.php
Maybe also check: https://javascript.info/ifelse

## Exercise 7: looping
Write a program that returns an array of strings (const) consisting of every name in "names" (from exercise 6) and their respective length multiplied by two: `["Anna 8", "Johannes 16" ...]`

Take a careful look at this!: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map

## Exercise 8: objects
Check the following object: 
`const zooAnimals = {
  "giraffe": { "weight": 910, "origin": "Botswana" },
  "giraffe": { "weight": 910, "origin": "Tanzania" },
  "lion": { "weight": 200, "origin": "Tanzania" },
  "elephant": { "weight": 5000, "origin": "India" },
  "penguin": { "weight": 30, "origin": "Argentina" },
  "penguin": { "weight": 28, "origin": "Argentina" },
  "koala": { "weight": 10, "origin": "Australia" },
};`
How would you check if an animal exists in the object? How would you check if an animal with a specific weight or a specific origin exists in the object?

Tips:

## Exercise 9: more HTML & CSS
Take you html code from exercise 2 or 3 and edit it so that you page looks better: write a title, write a short message that tells the user how to use your mini program, choose a background color and put your objects in the center of the page. Try checking how CSS can help you with this.

Check: https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/CSS_basics


Most exercises were taken from this source, feel free to practice with more of these if you feel like it: https://www.w3resource.com/javascript-exercises/javascript-basic-exercises.php

## TypeScript
A bit more advanced.

Check: 
https://www.typescriptlang.org/docs/handbook/basic-types.html
https://www.typescriptlang.org/docs/handbook/classes.html
https://www.typescriptlang.org/docs/handbook/interfaces.html

Task: 
Create a TypeScript class representing a basic library. The library should have methods for (1) adding books, (2) listing all books, and (3)finding a book by its title.

Hints:
- Define a Book interface/TypeScript type with properties like: title, author, genre, etc.
- Create a Library class with methods to add a book, list all books, and find a book by title.
- Use an array or a data structure to store the list of books within the Library class.

# Part 2. Getting started with JavaScript tooling
1.  [Download and install NodeJS](https://nodejs.org/en/download/) (LTS version).
2.  [Install Yarn](https://yarnpkg.com/getting-started/install) dependency manager (you might have to use &rsquo;sudo&rsquo; for
    this to work). Run this in your Terminal:
    
        corepack enable

3.  Create [Vite](https://vitejs.dev/) starter project:
    
        yarn create vite
    
    -   specify the arbitrary but meaningful name
    -   select Vanilla framework
    -   select JavaScript variant
    -   follow the further instructions
4.  You will see the link to the development instance,
    i.e. <http://localhost:5173/>. Open it. You should see the &ldquo;Hello
    Vite!&rdquo; webpage.
5.  Study the `.js`, `.css` and `.html` files generated by Vite. Make
    sure you understand what&rsquo;s going on there. Some questions to
    help you understand the files:
    - How are the files connected together? 
    - What method is used in the script files to retrieve and alter the
      HTML element?
# Part 3. Your first XState program
TBD (Vlad): &#x2026;turn the counter logic into a state logic&#x2026;


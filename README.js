/*
1. Which script should I run?

There are 3 scripts in our final deliverables. Depending on what time period you would like to visualize, 
chose a different script:

LS5: landsat5 Imagery runs classifiactions on years 1985-1991. Spatial resolution 30 meters.
LS8: landsat8 Imagery runs classifications on years 2013- present day. Spatial resolution 30 meters. 
Sentinel: Sentinel 2 data runs classifications on years 2015-present day. It also has a higher spatial resolution of 10 meters.


2. How do I run it?
open the script and hit "run" on the top blue bar. After this, a dialogue box should show up on the bottom left of the screen, 
follow the prompts to get an image.

3. Why isn't the script working?
It is possible that you do not have all of the asset files, or point and shape files associated with the script. Make sure you have 
added those to your asset repository, and that the file pathways are correct. It is also possible to run a year that Google Earth
Engine has no data for, this will also produce an error. 

4. What is the error matrix, accuracy and kappa coeffeicient tell me?
On line 227, you will see that some of the points used to classify the image are instead used to test the image. After the 
computer algorithm classification tool runs, we go back use these test test points, to see if they were classified accuratley.
This is the basis for the error matrix, kappa and overall accuracy. The error matrix show correctly classified points along
the diagonal. Think of it as a matrix:

0 1 2 3 4
1 9 0 0 0 
2 0 6 3 1
3 0 1 5 0
4 0 0 0 8

Here, all of the 1 and 4 points were classified correctly. The 2 points were often classified as 3. The Kappa and Accuracy 
are methods of gettting a percentile from the error matrix reading. 

*/

